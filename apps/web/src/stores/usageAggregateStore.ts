import type { EnvironmentId, UsageAggregateSnapshot } from "@t3tools/contracts";
import { create } from "zustand";

interface UsageAggregateStoreState {
  readonly byEnvironmentId: Readonly<Record<string, UsageAggregateSnapshot>>;
  setSnapshot: (environmentId: EnvironmentId, snapshot: UsageAggregateSnapshot) => void;
  clearEnvironment: (environmentId: EnvironmentId) => void;
}

export const useUsageAggregateStore = create<UsageAggregateStoreState>((set) => ({
  byEnvironmentId: {},
  setSnapshot: (environmentId, snapshot) =>
    set((state) => ({
      byEnvironmentId: {
        ...state.byEnvironmentId,
        [environmentId]: snapshot,
      },
    })),
  clearEnvironment: (environmentId) =>
    set((state) => {
      if (!(environmentId in state.byEnvironmentId)) {
        return state;
      }
      const next = { ...state.byEnvironmentId };
      delete next[environmentId];
      return { byEnvironmentId: next };
    }),
}));

export function readUsageAggregateSnapshot(
  environmentId: EnvironmentId,
): UsageAggregateSnapshot | undefined {
  return useUsageAggregateStore.getState().byEnvironmentId[environmentId];
}
