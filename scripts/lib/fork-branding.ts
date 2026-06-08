/** Fork-specific desktop and web branding defaults for the ARM64 build. */
export const FORK_DESKTOP_PRODUCT_NAME = "ARM64";
export const FORK_DESKTOP_APP_ID = "com.t3tools.t3code.arm64";
export const FORK_DESKTOP_ICON_VARIANT = "arm64";
export const FORK_WEB_APP_BASE_NAME = "ARM64";

export function resolveForkDesktopProductName(): string {
  const override = process.env.T3CODE_DESKTOP_PRODUCT_NAME?.trim();
  return override && override.length > 0 ? override : FORK_DESKTOP_PRODUCT_NAME;
}

export function resolveForkDesktopIconVariant(): typeof FORK_DESKTOP_ICON_VARIANT | null {
  const override = process.env.T3CODE_DESKTOP_ICON_VARIANT?.trim().toLowerCase();
  if (override === "arm64") {
    return "arm64";
  }
  if (override === "" || override === "default" || override === "production") {
    return null;
  }
  return FORK_DESKTOP_ICON_VARIANT;
}

export function resolveForkDesktopAppId(): string {
  const override = process.env.T3CODE_DESKTOP_APP_ID?.trim();
  return override && override.length > 0 ? override : FORK_DESKTOP_APP_ID;
}

/** Stage/install package name for the ARM64 fork (must not reuse upstream `t3code`). */
export function resolveForkStagePackageName(productName: string): string {
  return productName === FORK_DESKTOP_PRODUCT_NAME ? "arm64" : "t3code";
}

/** Windows executable file name (without `.exe`) for electron-builder. */
export function resolveForkWindowsExecutableName(productName: string): string {
  return productName === FORK_DESKTOP_PRODUCT_NAME ? FORK_DESKTOP_PRODUCT_NAME : productName;
}
