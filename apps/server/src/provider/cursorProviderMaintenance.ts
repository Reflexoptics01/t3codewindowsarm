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

export function knownCursorAgentPathEntries(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): ReadonlyArray<string> {
  if (platform !== "win32") {
    return [];
  }

  const entries: Array<string> = [];
  const localAppData = env.LOCALAPPDATA?.trim();
  if (localAppData) {
    entries.push(`${localAppData}\\cursor-agent`);
  }
  const userProfile = env.USERPROFILE?.trim();
  if (userProfile) {
    entries.push(`${userProfile}\\.local\\bin`);
  }
  return entries;
}

function cursorAgentResolutionEnv(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): NodeJS.ProcessEnv {
  const extraEntries = knownCursorAgentPathEntries(env, platform);
  if (extraEntries.length === 0) {
    return env;
  }

  const delimiter = platform === "win32" ? ";" : ":";
  const inheritedPath = env.PATH ?? env.Path ?? env.path;
  const mergedPath = [extraEntries.join(delimiter), inheritedPath]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(delimiter);

  return {
    ...env,
    PATH: mergedPath,
  };
}

export function resolveCursorAgentBinaryPath(
  binaryPath: string | undefined,
  options?: {
    readonly env?: NodeJS.ProcessEnv;
    readonly platform?: NodeJS.Platform;
  },
): string {
  const requested = binaryPath?.trim() || "agent";
  const platform = options?.platform ?? process.platform;
  const env = options?.env ?? process.env;
  const resolutionEnv = cursorAgentResolutionEnv(env, platform);
  const resolutionOptions = { env: resolutionEnv, platform };

  return (
    resolveCommandPath(requested, resolutionOptions) ??
    resolveCommandPath("cursor-agent", resolutionOptions) ??
    requested
  );
}

function isCursorAgentInstalled(
  binaryPath: string,
  options?: {
    readonly env?: NodeJS.ProcessEnv;
    readonly platform?: NodeJS.Platform;
  },
): boolean {
  const platform = options?.platform ?? process.platform;
  const env = cursorAgentResolutionEnv(options?.env ?? process.env, platform);
  const resolutionOptions = { env, platform };
  const requested = binaryPath.trim() || "agent";
  return (
    resolveCommandPath(requested, resolutionOptions) !== null ||
    resolveCommandPath("cursor-agent", resolutionOptions) !== null
  );
}

export const makeCursorProviderMaintenanceResolver =
  (): ProviderMaintenanceCapabilitiesResolver => ({
    resolve: (options) => {
      const binaryPath = options?.binaryPath?.trim() || "agent";
      const platform = options?.platform ?? process.platform;
      const resolutionOptions = {
        env: cursorAgentResolutionEnv(options?.env ?? process.env, platform),
        platform,
      };

      if (!isCursorAgentInstalled(binaryPath, resolutionOptions)) {
        return resolveCursorInstallCapabilities();
      }

      const resolvedBinaryPath = resolveCursorAgentBinaryPath(binaryPath, resolutionOptions);
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
