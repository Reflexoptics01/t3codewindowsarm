import type {
  OrchestrationEvent,
  ThreadTokenUsageSnapshot,
  UsageAggregateSnapshot,
  UsageWindowKind,
} from "@t3tools/contracts";
import { makeDrainableWorker } from "@t3tools/shared/DrainableWorker";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import { UsageAggregator, type UsageAggregatorShape } from "../Services/UsageAggregator.ts";

const FIVE_HOUR_WINDOW_MS = 5 * 60 * 60 * 1000;
const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const USAGE_REPUBLISH_INTERVAL_MS = 30_000;

interface TurnUsageDelta {
  readonly turnId: string;
  readonly recordedAtMs: number;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly reasoningOutputTokens: number;
  readonly totalTokens: number;
}

function asFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function toTurnUsageDelta(
  payload: ThreadTokenUsageSnapshot,
  turnId: string,
  recordedAtMs: number,
): TurnUsageDelta {
  const inputTokens = asFiniteNumber(payload.lastInputTokens ?? payload.inputTokens);
  const cachedInputTokens = asFiniteNumber(
    payload.lastCachedInputTokens ?? payload.cachedInputTokens,
  );
  const outputTokens = asFiniteNumber(payload.lastOutputTokens ?? payload.outputTokens);
  const reasoningOutputTokens = asFiniteNumber(
    payload.lastReasoningOutputTokens ?? payload.reasoningOutputTokens,
  );
  const lastUsed = asFiniteNumber(payload.lastUsedTokens);
  const total = Math.max(lastUsed, inputTokens + outputTokens);
  return {
    turnId,
    recordedAtMs,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens: total,
  };
}

function monthlyWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

function pruneWindow(
  entries: ReadonlyArray<TurnUsageDelta>,
  cutoffMs: number,
): ReadonlyArray<TurnUsageDelta> {
  let pruneIndex = 0;
  while (pruneIndex < entries.length && entries[pruneIndex]!.recordedAtMs < cutoffMs) {
    pruneIndex += 1;
  }
  return pruneIndex === 0 ? entries : entries.slice(pruneIndex);
}

function tallyWindow(entries: ReadonlyArray<TurnUsageDelta>) {
  let totalTokens = 0;
  let inputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;
  let reasoningOutputTokens = 0;
  for (const delta of entries) {
    totalTokens += delta.totalTokens;
    inputTokens += delta.inputTokens;
    cachedInputTokens += delta.cachedInputTokens;
    outputTokens += delta.outputTokens;
    reasoningOutputTokens += delta.reasoningOutputTokens;
  }
  return {
    totalTokens,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    turnCount: entries.length,
  };
}

function formatIsoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

function buildSnapshot(args: {
  readonly generatedAtMs: number;
  readonly lastTurnAtMs: number | null;
  readonly fiveHourEntries: ReadonlyArray<TurnUsageDelta>;
  readonly weeklyEntries: ReadonlyArray<TurnUsageDelta>;
  readonly monthlyEntries: ReadonlyArray<TurnUsageDelta>;
}): UsageAggregateSnapshot {
  const fiveHourWindowEndMs = args.generatedAtMs;
  const fiveHourWindowStartMs = fiveHourWindowEndMs - FIVE_HOUR_WINDOW_MS;
  const weeklyWindowEndMs = args.generatedAtMs;
  const weeklyWindowStartMs = weeklyWindowEndMs - WEEKLY_WINDOW_MS;
  const { start: monthlyStart, end: monthlyEnd } = monthlyWindow(new Date(args.generatedAtMs));
  return {
    generatedAt: formatIsoFromMs(args.generatedAtMs),
    lastTurnAt: args.lastTurnAtMs === null ? null : formatIsoFromMs(args.lastTurnAtMs),
    fiveHour: {
      windowStart: formatIsoFromMs(fiveHourWindowStartMs),
      windowEnd: formatIsoFromMs(fiveHourWindowEndMs),
      limitTokens: null,
      limitResetsAt: null,
      ...tallyWindow(args.fiveHourEntries),
    },
    weekly: {
      windowStart: formatIsoFromMs(weeklyWindowStartMs),
      windowEnd: formatIsoFromMs(weeklyWindowEndMs),
      limitTokens: null,
      limitResetsAt: null,
      ...tallyWindow(args.weeklyEntries),
    },
    monthly: {
      windowStart: formatIsoFromMs(monthlyStart.getTime()),
      windowEnd: formatIsoFromMs(monthlyEnd.getTime()),
      limitTokens: null,
      limitResetsAt: null,
      ...tallyWindow(args.monthlyEntries),
    },
  };
}

function isUsageWindowKind(value: string): value is UsageWindowKind {
  return value === "five-hour" || value === "weekly" || value === "monthly";
}

export { isUsageWindowKind };

const make = Effect.gen(function* () {
  const orchestrationEngine = yield* OrchestrationEngineService;

  const fiveHourEntriesRef = yield* Ref.make<ReadonlyArray<TurnUsageDelta>>([]);
  const weeklyEntriesRef = yield* Ref.make<ReadonlyArray<TurnUsageDelta>>([]);
  const monthlyEntriesRef = yield* Ref.make<ReadonlyArray<TurnUsageDelta>>([]);
  const seenTurnIdsRef = yield* Ref.make<Set<string>>(new Set());
  const lastTurnAtMsRef = yield* Ref.make<number | null>(null);
  const snapshotRef = yield* Ref.make<UsageAggregateSnapshot>(
    buildSnapshot({
      generatedAtMs: 0,
      lastTurnAtMs: null,
      fiveHourEntries: [],
      weeklyEntries: [],
      monthlyEntries: [],
    }),
  );
  const snapshotPubSub = yield* PubSub.unbounded<UsageAggregateSnapshot>();

  const republishSnapshot = (nowMs: number) =>
    Effect.gen(function* () {
      const [currentFiveHour, currentWeekly, currentMonthly, lastTurnAt] = yield* Effect.all([
        Ref.get(fiveHourEntriesRef),
        Ref.get(weeklyEntriesRef),
        Ref.get(monthlyEntriesRef),
        Ref.get(lastTurnAtMsRef),
      ]);
      const fiveHourCutoffMs = nowMs - FIVE_HOUR_WINDOW_MS;
      const weeklyCutoffMs = nowMs - WEEKLY_WINDOW_MS;
      const monthStart = monthlyWindow(new Date(nowMs)).start.getTime();
      const nextFiveHour = pruneWindow(currentFiveHour, fiveHourCutoffMs);
      const nextWeekly = pruneWindow(currentWeekly, weeklyCutoffMs);
      const nextMonthly = pruneWindow(currentMonthly, monthStart);
      if (nextFiveHour !== currentFiveHour) {
        yield* Ref.set(fiveHourEntriesRef, nextFiveHour);
      }
      if (nextWeekly !== currentWeekly) {
        yield* Ref.set(weeklyEntriesRef, nextWeekly);
      }
      if (nextMonthly !== currentMonthly) {
        yield* Ref.set(monthlyEntriesRef, nextMonthly);
      }
      const snapshot = buildSnapshot({
        generatedAtMs: nowMs,
        lastTurnAtMs: lastTurnAt,
        fiveHourEntries: nextFiveHour,
        weeklyEntries: nextWeekly,
        monthlyEntries: nextMonthly,
      });
      yield* Ref.set(snapshotRef, snapshot);
      yield* PubSub.publish(snapshotPubSub, snapshot);
    });

  const recordTurnDelta = (delta: TurnUsageDelta) =>
    Effect.gen(function* () {
      const [seenTurnIds, currentFiveHour, currentWeekly, currentMonthly, previousLastTurn] =
        yield* Effect.all([
          Ref.get(seenTurnIdsRef),
          Ref.get(fiveHourEntriesRef),
          Ref.get(weeklyEntriesRef),
          Ref.get(monthlyEntriesRef),
          Ref.get(lastTurnAtMsRef),
        ]);
      if (seenTurnIds.has(delta.turnId)) {
        return;
      }
      const nextSeen = new Set(seenTurnIds);
      nextSeen.add(delta.turnId);

      const monthStart = monthlyWindow(new Date(delta.recordedAtMs)).start.getTime();
      const fiveHourCutoffMs = delta.recordedAtMs - FIVE_HOUR_WINDOW_MS;
      const weeklyCutoffMs = delta.recordedAtMs - WEEKLY_WINDOW_MS;

      const nextFiveHour = [...pruneWindow(currentFiveHour, fiveHourCutoffMs), delta];
      const nextWeekly = [...pruneWindow(currentWeekly, weeklyCutoffMs), delta];
      const nextMonthly = [...pruneWindow(currentMonthly, monthStart), delta];
      const nextLastTurn = Math.max(previousLastTurn ?? delta.recordedAtMs, delta.recordedAtMs);

      const snapshot = buildSnapshot({
        generatedAtMs: delta.recordedAtMs,
        lastTurnAtMs: nextLastTurn,
        fiveHourEntries: nextFiveHour,
        weeklyEntries: nextWeekly,
        monthlyEntries: nextMonthly,
      });

      yield* Ref.set(seenTurnIdsRef, nextSeen);
      yield* Ref.set(fiveHourEntriesRef, nextFiveHour);
      yield* Ref.set(weeklyEntriesRef, nextWeekly);
      yield* Ref.set(monthlyEntriesRef, nextMonthly);
      yield* Ref.set(lastTurnAtMsRef, nextLastTurn);
      yield* Ref.set(snapshotRef, snapshot);
      yield* PubSub.publish(snapshotPubSub, snapshot);
    });

  const processActivityEvent = (
    event: Extract<OrchestrationEvent, { type: "thread.activity-appended" }>,
  ) =>
    Effect.gen(function* () {
      const activity = event.payload.activity;
      if (activity.kind !== "context-window.updated") {
        return;
      }
      const turnIdValue = activity.turnId;
      if (typeof turnIdValue !== "string" || turnIdValue.length === 0) {
        return;
      }
      const payloadRecord = asRecord(activity.payload);
      if (!payloadRecord) {
        return;
      }
      const payload = payloadRecord as ThreadTokenUsageSnapshot;
      const lastUsed = asFiniteNumber(payload.lastUsedTokens);
      const lastInput = asFiniteNumber(payload.lastInputTokens ?? payload.inputTokens);
      const lastOutput = asFiniteNumber(payload.lastOutputTokens ?? payload.outputTokens);
      if (lastUsed <= 0 && lastInput <= 0 && lastOutput <= 0) {
        return;
      }
      const recordedAtMs = yield* Clock.currentTimeMillis;
      yield* recordTurnDelta(toTurnUsageDelta(payload, turnIdValue, recordedAtMs));
    });

  const processActivitySafely = (
    event: Extract<OrchestrationEvent, { type: "thread.activity-appended" }>,
  ) =>
    processActivityEvent(event).pipe(
      Effect.catchCause((cause) => {
        if (Cause.hasInterruptsOnly(cause)) {
          return Effect.failCause(cause);
        }
        return Effect.logWarning("usage aggregator failed to process activity event", {
          eventId: event.eventId,
          cause: Cause.pretty(cause),
        });
      }),
    );

  const worker = yield* makeDrainableWorker(processActivitySafely);

  const start: UsageAggregatorShape["start"] = Effect.fn("usageAggregator.start")(function* () {
    yield* Effect.forkScoped(
      Stream.runForEach(orchestrationEngine.streamDomainEvents, (event) => {
        if (event.type !== "thread.activity-appended") {
          return Effect.void;
        }
        if (event.payload.activity.kind !== "context-window.updated") {
          return Effect.void;
        }
        return worker.enqueue(event);
      }),
    );
    yield* Effect.forkScoped(
      Effect.forever(
        Effect.gen(function* () {
          yield* Effect.sleep(Duration.millis(USAGE_REPUBLISH_INTERVAL_MS));
          yield* republishSnapshot(yield* Clock.currentTimeMillis);
        }).pipe(
          Effect.catchCause((cause) =>
            Cause.hasInterruptsOnly(cause)
              ? Effect.failCause(cause)
              : Effect.logWarning("usage aggregator republish loop failed", {
                  cause: Cause.pretty(cause),
                }),
          ),
        ),
      ),
    );
  });

  const snapshot: UsageAggregatorShape["snapshot"] = Ref.get(snapshotRef);

  const streamUpdates: UsageAggregatorShape["streamUpdates"] = Stream.fromPubSub(snapshotPubSub);

  return {
    start,
    snapshot,
    streamUpdates,
  } satisfies UsageAggregatorShape;
});

export const UsageAggregatorLive = Layer.effect(UsageAggregator, make);

// Internal helpers exposed for unit tests so we can exercise the windowing
// math without spinning up the orchestration engine.
export const __testing = { buildSnapshot, pruneWindow, tallyWindow };
