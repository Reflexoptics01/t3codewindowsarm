import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { desktopDir } from "./electron-launcher.mjs";

const repoRoot = join(desktopDir, "../..");
const resourcesDir = join(desktopDir, "resources");

/** Keep in sync with scripts/lib/brand-assets.ts arm64 desktop paths. */
const ARM64_DESKTOP_ICON_SOURCES = {
  ico: join(repoRoot, "assets/arm64/arm64-windows.ico"),
  png: join(repoRoot, "assets/arm64/arm64-universal-1024.png"),
};

export function syncDesktopResources() {
  mkdirSync(resourcesDir, { recursive: true });
  copyFileSync(ARM64_DESKTOP_ICON_SOURCES.ico, join(resourcesDir, "icon.ico"));
  copyFileSync(ARM64_DESKTOP_ICON_SOURCES.png, join(resourcesDir, "icon.png"));
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  syncDesktopResources();
}
