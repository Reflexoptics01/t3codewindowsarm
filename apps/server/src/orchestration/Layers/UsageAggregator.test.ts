import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import type { OrchestrationEvent } from "@t3tools/contracts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import { UsageAggregator } from "../Services/UsageAggregator.ts";
import { UsageAggregatorLive, __testing } from "./UsageAggregator.ts";

function makeEngineLayer(stream: Stream.Stream<OrchestrationEvent>) {
  return Layer.succeed(OrchestrationEngineService, {
    readEvents: () => stream,
    dispatch: () => Effect.die("not used in tests"),
    streamDomainEvents: stream,
  });
}

describe("UsageAggregator windowing math", () => {
  it.effect("buildSnapshot returns zeroed windows for empty input", () =>
    Effect.sync(() => {
      const snapshot = __testing.buildSnapshot({
        generatedAtMs: Date.UTC(2026, 5, 2, 12, 0, 0),
        lastTurnAtMs: null,
        fiveHourEntries: [],
        monthlyEntries: [],
      });
      assert.equal(snapshot.fiveHour.totalTokens, 0);
      assert.equal(snapshot.fiveHour.turnCount, 0);
      assert.equal(snapshot.monthly.totalTokens, 0);
      assert.equal(snapshot.lastTurnAt, null);
    }),
  );

  it.effect("tallyWindow sums deltas across entries", () =>
    Effect.sync(() => {
      const result = __testing.tallyWindow([
        {
          turnId: "a",
          recordedAtMs: 1,
          inputTokens: 10,
          cachedInputTokens: 2,
          outputTokens: 3,
          reasoningOutputTokens: 1,
          totalTokens: 14,
        },
        {
          turnId: "b",
          recordedAtMs: 2,
          inputTokens: 20,
          cachedInputTokens: 0,
          outputTokens: 5,
          reasoningOutputTokens: 0,
          totalTokens: 25,
        },
      ]);
      assert.equal(result.totalTokens, 39);
      assert.equal(result.inputTokens, 30);
      assert.equal(result.outputTokens, 8);
      assert.equal(result.cachedInputTokens, 2);
      assert.equal(result.reasoningOutputTokens, 1);
      assert.equal(result.turnCount, 2);
    }),
  );

  it.effect("pruneWindow drops entries older than the cutoff", () =>
    Effect.sync(() => {
      const entries = [
        {
          turnId: "old",
          recordedAtMs: 100,
          inputTokens: 0,
          cachedInputTokens: 0,
          outputTokens: 0,
          reasoningOutputTokens: 0,
          totalTokens: 0,
        },
        {
          turnId: "fresh",
          recordedAtMs: 200,
          inputTokens: 0,
          cachedInputTokens: 0,
          outputTokens: 0,
          reasoningOutputTokens: 0,
          totalTokens: 0,
        },
      ];
      const next = __testing.pruneWindow(entries, 150);
      assert.equal(next.length, 1);
      assert.equal(next[0]!.turnId, "fresh");
    }),
  );
});

describe("UsageAggregator service", () => {
  it.effect("starts with an empty snapshot", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const aggregator = yield* UsageAggregator;
        yield* aggregator.start();
        const snap = yield* aggregator.snapshot;
        assert.equal(snap.fiveHour.totalTokens, 0);
        assert.equal(snap.fiveHour.turnCount, 0);
        assert.equal(snap.monthly.totalTokens, 0);
      }).pipe(
        Effect.provide(
          UsageAggregatorLive.pipe(Layer.provide(makeEngineLayer(Stream.empty))),
        ),
      ),
    ),
  );
});
