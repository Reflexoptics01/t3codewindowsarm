/**
 * UsageAggregator - Service interface for the server-side token-usage aggregator.
 *
 * Subscribes to orchestration domain events, tallies per-turn token consumption
 * across every thread, and exposes a hot stream of `UsageAggregateSnapshot`
 * updates. Each stream access is an independent subscription (mirrors the
 * engine's `streamDomainEvents` contract) so multiple WS clients each receive
 * the full sequence of snapshots.
 *
 * The aggregator keeps state in memory only. It is intended for at-a-glance
 * rate-limit awareness (the OpenCode-style 5h rolling window and the current
 * calendar month), not for billing reconciliation.
 *
 * @module UsageAggregator
 */
import type { UsageAggregateSnapshot } from "@t3tools/contracts";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";
import type * as Stream from "effect/Stream";

/**
 * UsageAggregatorShape - Service API for usage aggregation.
 */
export interface UsageAggregatorShape {
  /**
   * Start the background worker that consumes orchestration events and
   * updates the usage snapshot.
   *
   * The returned effect must be run in a scope so all worker fibers can be
   * finalized on shutdown.
   */
  readonly start: () => Effect.Effect<void, never, Scope.Scope>;

  /**
   * Read the current aggregate snapshot.
   */
  readonly snapshot: Effect.Effect<UsageAggregateSnapshot>;

  /**
   * Subscribe to a stream of usage snapshots. The first emission is the
   * current snapshot, followed by a fresh snapshot every time a turn's
   * token consumption has been observed.
   */
  readonly streamUpdates: Stream.Stream<UsageAggregateSnapshot>;
}

/**
 * UsageAggregator - Service tag for the usage aggregator.
 */
export class UsageAggregator extends Context.Service<UsageAggregator, UsageAggregatorShape>()(
  "t3/orchestration/Services/UsageAggregator/UsageAggregator",
) {}
