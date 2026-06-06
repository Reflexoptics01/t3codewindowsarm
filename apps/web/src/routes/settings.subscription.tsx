import { createFileRoute } from "@tanstack/react-router";

import { SubscriptionSettingsPanel } from "../components/settings/SubscriptionSettings";

export const Route = createFileRoute("/settings/subscription")({
  component: SubscriptionSettingsPanel,
});
