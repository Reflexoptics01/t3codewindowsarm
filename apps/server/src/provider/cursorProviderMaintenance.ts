import { ProviderDriverKind } from "@t3tools/contracts";
import { resolveCommandPath } from "@t3tools/shared/shell";

import {
  makeProviderMaintenanceCapabilities,
  type ProviderMaintenanceCapabilities,
  type ProviderMaintenanceCapabilitiesResolver,
} from "./providerMaintenance.ts";

const DRIVER_KIND = ProviderDriverKind.make("cursor");

function resolveCursorInstallCapabilities(): ProviderMaintenanceCapabilities {
  if (process.platform === "win32") {
    return makeProviderMaintenanceCapabilities({
      provider: DRIVER_KIND,
      packageName: null,
      updateExecutable: "powershell",
      updateArgs: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "irm 'https://cursor.com/install?win32=true' | iex",
      ],
      updateLockKey: "cursor-agent-install",
    });
  }

  return makeProviderMaintenanceCapabilities({
    provider: DRIVER_KIND,
    packageName: null,
    updateExecutable: "bash",
    updateArgs: ["-lc", "curl https://cursor.com/install -fsS | bash"],
    updateLockKey: "cursor-agent-install",
  });
}

function resolveCursorUpdateCapabilities(binaryPath: string): ProviderMaintenanceCapabilities {
  return makeProviderMaintenanceCapabilities({
    provider: DRIVER_KIND,
    packageName: null,
    updateExecutable: binaryPath,
    updateArgs: ["update"],
    updateLockKey: "cursor-agent",
  });
}

function isCursorAgentInstalled(
  binaryPath: string,
  options?: {
    readonly env?: NodeJS.ProcessEnv;
    readonly platform?: NodeJS.Platform;
  },
): boolean {
  return (
    resolveCommandPath(binaryPath, options) !== null ||
    resolveCommandPath("cursor-agent", options) !== null
  );
}

export const makeCursorProviderMaintenanceResolver = (): ProviderMaintenanceCapabilitiesResolver => ({
  resolve: (options) => {
    const binaryPath = options?.binaryPath?.trim() || "agent";
    const resolutionOptions = {
      ...(options?.env ? { env: options.env } : {}),
      ...(options?.platform ? { platform: options.platform } : {}),
    };

    if (!isCursorAgentInstalled(binaryPath, resolutionOptions)) {
      return resolveCursorInstallCapabilities();
    }

    const resolvedBinaryPath =
      resolveCommandPath(binaryPath, resolutionOptions) ??
      resolveCommandPath("cursor-agent", resolutionOptions) ??
      binaryPath;
    return resolveCursorUpdateCapabilities(resolvedBinaryPath);
  },
});

export function resolveCursorInstallCommand(environment: NodeJS.ProcessEnv = process.env): string {
  void environment;
  return resolveCursorInstallCapabilities().update?.command ?? "agent update";
}

export function resolveCursorMaintenanceCapabilities(input?: {
  readonly binaryPath?: string | null;
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
}): ProviderMaintenanceCapabilities {
  return makeCursorProviderMaintenanceResolver().resolve({
    ...(input?.binaryPath ? { binaryPath: input.binaryPath } : {}),
    ...(input?.env ? { env: input.env } : {}),
    ...(input?.platform ? { platform: input.platform } : {}),
  });
}
