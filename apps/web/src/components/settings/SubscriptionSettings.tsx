import { ExternalLinkIcon } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import type { UsageAggregateSnapshot, UsageWindowSnapshot } from "@t3tools/contracts";

import { usePrimaryEnvironmentId } from "../../environments/primary";
import { cn } from "../../lib/utils";
import { useUsageAggregateStore } from "../../stores/usageAggregateStore";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  SettingResetButton,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  useRelativeTimeTick,
} from "./settingsLayout";
import { useSettings, useUpdateSettings } from "../../hooks/useSettings";
import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";
import {
  SUBSCRIPTION_USAGE_WINDOWS,
  GO_LEARN_MORE_URL,
  GO_PROVIDER_NAME,
  GO_PROVIDER_CONFIG_DOC_URL,
  computeUsagePercent,
  formatResetLabel,
  formatUsagePercent,
  usageWindowFor,
  type UsageWindowDescriptor,
} from "./SubscriptionSettings.logic";

function GoWordmark() {
  return (
    <div className="inline-flex h-6 items-center bg-foreground px-1.5 text-background">
      <span className="font-mono text-[12px] font-bold leading-none tracking-tight">GO</span>
    </div>
  );
}

function LearnMoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-baseline gap-0.5 text-foreground underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:decoration-foreground/80"
    >
      {children}
      <ExternalLinkIcon className="size-3 shrink-0" />
    </a>
  );
}

function UsageBar(props: {
  readonly descriptor: UsageWindowDescriptor;
  readonly window: UsageWindowSnapshot | undefined;
  readonly nowMs: number;
}) {
  const { descriptor, window, nowMs } = props;
  const percent = computeUsagePercent(window);
  const hasLimit = percent !== null;
  const widthPercent = hasLimit ? formatUsagePercent(percent) : "0%";
  const resetLabel = formatResetLabel(window, nowMs);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
          {descriptor.label}
        </h3>
        <span
          className={cn(
            "text-xs tabular-nums",
            hasLimit ? "text-foreground" : "text-muted-foreground/70",
          )}
        >
          {hasLimit ? widthPercent : "—"}
        </span>
      </div>
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/60"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hasLimit ? Math.round(percent) : undefined}
        aria-label={`${descriptor.label} usage`}
      >
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: widthPercent }}
        />
      </div>
      <p className="text-xs text-muted-foreground/80">{resetLabel}</p>
    </div>
  );
}

function UsageBarsSection({ snapshot }: { snapshot: UsageAggregateSnapshot | undefined }) {
  const nowMs = useRelativeTimeTick(1_000);
  return (
    <div className="grid gap-6 px-4 py-4 sm:px-5 sm:py-5 md:grid-cols-3">
      {SUBSCRIPTION_USAGE_WINDOWS.map((descriptor) => (
        <UsageBar
          key={descriptor.kind}
          descriptor={descriptor}
          window={usageWindowFor(snapshot, descriptor.kind)}
          nowMs={nowMs}
        />
      ))}
    </div>
  );
}

export function SubscriptionSettingsPanel() {
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const snapshot = useUsageAggregateStore((state) =>
    primaryEnvironmentId ? state.byEnvironmentId[primaryEnvironmentId] : undefined,
  );
  const settings = useSettings();
  const { updateSettings } = useUpdateSettings();
  const useBalance = settings.useAvailableBalanceAfterLimit;
  const providerConfigDescription = useMemo(
    () =>
      `Select "${GO_PROVIDER_NAME}" as the provider in your opencode configuration to use Go models.`,
    [],
  );

  return (
    <SettingsPageContainer>
      <SettingsSection title={GO_PROVIDER_NAME}>
        <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="flex items-start gap-3">
            <GoWordmark />
            <p className="pt-0.5 text-[13px] text-foreground/80">
              Low cost coding models for everyone.{" "}
              <LearnMoreLink href={GO_LEARN_MORE_URL}>Learn more</LearnMoreLink>.
            </p>
          </div>
          <Button
            size="sm"
            variant="default"
            className="shrink-0 sm:self-start"
            render={
              <a href={GO_LEARN_MORE_URL} target="_blank" rel="noreferrer">
                Manage Subscription
              </a>
            }
          />
        </div>
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3 sm:px-5">
          <p className="text-xs text-muted-foreground/80">
            {providerConfigDescription}{" "}
            <LearnMoreLink href={GO_PROVIDER_CONFIG_DOC_URL}>Learn more</LearnMoreLink>.
          </p>
        </div>
        <UsageBarsSection snapshot={snapshot} />
      </SettingsSection>

      <SettingsSection title="Billing">
        <SettingsRow
          title="Use your available balance after reaching the usage limits"
          description="Continue running turns from your available API balance once the Go plan usage limits are exhausted. Off by default so the plan limit acts as a hard stop."
          resetAction={
            useBalance !== DEFAULT_UNIFIED_SETTINGS.useAvailableBalanceAfterLimit ? (
              <SettingResetButton
                label="use available balance after limit"
                onClick={() =>
                  updateSettings({
                    useAvailableBalanceAfterLimit:
                      DEFAULT_UNIFIED_SETTINGS.useAvailableBalanceAfterLimit,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={useBalance}
              onCheckedChange={(checked) =>
                updateSettings({ useAvailableBalanceAfterLimit: Boolean(checked) })
              }
              aria-label="Use your available balance after reaching the usage limits"
            />
          }
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}
