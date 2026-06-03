import * as Schema from "effect/Schema";

import { IsoDateTime, NonNegativeInt } from "./baseSchemas.ts";

export const UsageWindowKind = Schema.Literals(["five-hour", "monthly"]);
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
});
export type UsageWindowSnapshot = typeof UsageWindowSnapshot.Type;

export const UsageAggregateSnapshot = Schema.Struct({
  generatedAt: IsoDateTime,
  lastTurnAt: Schema.NullOr(IsoDateTime),
  fiveHour: UsageWindowSnapshot,
  monthly: UsageWindowSnapshot,
});
export type UsageAggregateSnapshot = typeof UsageAggregateSnapshot.Type;
