import type { UsageWindowSnapshot } from "@t3tools/contracts";

export type UsageWindowDescriptor = {
  readonly kind: "five-hour" | "weekly" | "monthly";
  readonly label: string;
};

export const SUBSCRIPTION_USAGE_WINDOWS: ReadonlyArray<UsageWindowDescriptor> = [
  { kind: "five-hour", label: "Rolling Usage" },
  { kind: "weekly", label: "Weekly Usage" },
  { kind: "monthly", label: "Monthly Usage" },
];

export const GO_PROVIDER_NAME = "OpenCode Go";
export const GO_LEARN_MORE_URL = "https://opencode.com/go";
export const GO_PROVIDER_CONFIG_DOC_URL = "https://opencode.com/docs/providers";

export function usageWindowFor(
  snapshot:
    | {
        readonly fiveHour: UsageWindowSnapshot;
        readonly weekly: UsageWindowSnapshot;
        readonly monthly: UsageWindowSnapshot;
      }
    | undefined,
  kind: UsageWindowDescriptor["kind"],
): UsageWindowSnapshot | undefined {
  if (!snapshot) return undefined;
  if (kind === "five-hour") return snapshot.fiveHour;
  if (kind === "weekly") return snapshot.weekly;
  return snapshot.monthly;
}

export function clampUsagePercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  if (percent < 0) return 0;
  if (percent > 100) return 100;
  return Math.round(percent);
}

export function formatUsagePercent(percent: number): string {
  return `${clampUsagePercent(percent)}%`;
}

export function computeUsagePercent(window: UsageWindowSnapshot | undefined): number | null {
  if (!window) return null;
  if (window.limitTokens === null || window.limitTokens <= 0) return null;
  return (window.totalTokens / window.limitTokens) * 100;
}

/**
 * Format a positive duration in ms as "Xd Yh", "Xh Ym", "Xm Ys" or "Ys".
 * Returns "—" for non-positive or non-finite inputs.
 */
export function formatResetDuration(msUntilReset: number, nowMs: number): string {
  if (!Number.isFinite(msUntilReset) || msUntilReset <= 0) return "—";
  const deltaMs = Math.max(0, msUntilReset - nowMs);
  const totalSeconds = Math.floor(deltaMs / 1000);
  if (totalSeconds <= 0) return "0 minutes";

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    if (hours === 0) return `${days} days`;
    return `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (hours > 0) {
    if (minutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
    return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  if (minutes > 0) {
    if (seconds === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`;
  }
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

export function formatResetLabel(window: UsageWindowSnapshot | undefined, nowMs: number): string {
  if (!window) return "Resets in —";
  if (window.limitResetsAt) {
    const resetMs = new Date(window.limitResetsAt).getTime();
    if (Number.isFinite(resetMs) && resetMs > nowMs) {
      return `Resets in ${formatResetDuration(resetMs, nowMs)}`;
    }
  }
  return `Resets in ${formatResetDuration(new Date(window.windowEnd).getTime(), nowMs)}`;
}
