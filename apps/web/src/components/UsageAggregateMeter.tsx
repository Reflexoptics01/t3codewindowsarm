import type { UsageAggregateSnapshot } from "@t3tools/contracts";

import { formatContextWindowTokens } from "~/lib/contextWindow";
import { cn } from "~/lib/utils";
import { Popover, PopoverPopup, PopoverTrigger } from "./ui/popover";

function formatWindowLabel(kind: "five-hour" | "monthly"): string {
  return kind === "five-hour" ? "Last 5 hours" : "This month";
}

function WindowSummary(props: {
  readonly label: string;
  readonly window: UsageAggregateSnapshot["fiveHour"];
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {props.label}
      </div>
      <div className="text-xs font-medium text-foreground">
        {formatContextWindowTokens(props.window.totalTokens)} tokens
      </div>
      <div className="text-[11px] text-muted-foreground">
        {props.window.turnCount} turn{props.window.turnCount === 1 ? "" : "s"} · in{" "}
        {formatContextWindowTokens(props.window.inputTokens)} / out{" "}
        {formatContextWindowTokens(props.window.outputTokens)}
      </div>
    </div>
  );
}

export function UsageAggregateMeter(props: {
  readonly snapshot: UsageAggregateSnapshot | undefined;
  readonly compact?: boolean;
}) {
  const { snapshot, compact = false } = props;
  if (!snapshot) {
    return null;
  }

  const fiveHourTokens = snapshot.fiveHour.totalTokens;
  const label = `${formatContextWindowTokens(fiveHourTokens)} / 5h`;

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={0}
        render={
          <button
            type="button"
            className={cn(
              "inline-flex items-center rounded-md border border-border/70 bg-background/60 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground",
              compact ? "h-7 px-2 text-[11px]" : "h-8 px-2.5 text-xs",
            )}
            aria-label={`Token usage ${label}`}
          >
            {label}
          </button>
        }
      />
      <PopoverPopup tooltipStyle side="top" align="start" className="w-max max-w-none px-3 py-2.5">
        <div className="space-y-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Token usage
          </div>
          <WindowSummary label={formatWindowLabel("five-hour")} window={snapshot.fiveHour} />
          <WindowSummary label={formatWindowLabel("monthly")} window={snapshot.monthly} />
        </div>
      </PopoverPopup>
    </Popover>
  );
}
