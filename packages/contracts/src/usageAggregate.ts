import * as Schema from "effect/Schema";

import { IsoDateTime, NonNegativeInt } from "./baseSchemas.ts";

export const UsageWindowKind = Schema.Literals(["five-hour", "weekly", "monthly"]);
export type UsageWindowKind = typeof UsageWindowKind.Type;

export const UsageWindowSnapshot = Schema.Struct({
  windowStart: IsoDateTime,
  windowEnd: IsoDateTime,
  totalTokens: NonNegativeInt,
  inputTokens: NonNegativeInt,
  cachedInputTokens: NonNegativeInt,
  outputTokens: NonNegativeInt,
  reasoningOutputTokens: NonNegativeInt,
  turnCount: NonNegativeInt,
  /**
   * Optional plan limit attached by the provider. When unset, the UI cannot
   * derive a percentage and shows a "no data" indicator.
   */
  limitTokens: Schema.NullOr(NonNegativeInt),
  /**
   * Optional ISO 8601 instant at which the limit window resets. Drives the
   * "Resets in 4 days 3 hours" countdown displayed alongside each usage bar.
   */
  limitResetsAt: Schema.NullOr(IsoDateTime),
});
export type UsageWindowSnapshot = typeof UsageWindowSnapshot.Type;

export const UsageAggregateSnapshot = Schema.Struct({
  generatedAt: IsoDateTime,
  lastTurnAt: Schema.NullOr(IsoDateTime),
  fiveHour: UsageWindowSnapshot,
  weekly: UsageWindowSnapshot,
  monthly: UsageWindowSnapshot,
});
export type UsageAggregateSnapshot = typeof UsageAggregateSnapshot.Type;
