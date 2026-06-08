import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import {
  resolveDesktopRuntimeDependencies,
  resolveBuildOptions,
  resolveDesktopArtifactName,
  resolveDesktopBuildIconAssets,
  resolveDesktopIconVariant,
  resolveDesktopProductName,
  resolveDesktopUpdateChannel,
  resolveWindowsUnpackedExecutableName,
  resolveMockUpdateServerPort,
  resolveMockUpdateServerUrl,
} from "./build-desktop-artifact.ts";
import { BRAND_ASSET_PATHS } from "./lib/brand-assets.ts";
import {
  resolveForkStagePackageName,
  resolveForkWindowsExecutableName,
} from "./lib/fork-branding.ts";

it.layer(NodeServices.layer)("build-desktop-artifact", (it) => {
  it("resolves the dedicated nightly updater channel from nightly versions", () => {
    assert.equal(resolveDesktopUpdateChannel("0.0.17-nightly.20260413.42"), "nightly");
    assert.equal(resolveDesktopUpdateChannel("0.0.17"), "latest");
  });

  it("uses distinct ARM64 fork stage and executable names on Windows", () => {
    assert.equal(resolveForkStagePackageName("ARM64"), "arm64");
    assert.equal(resolveForkStagePackageName("T3 Code"), "t3code");
    assert.equal(resolveForkWindowsExecutableName("ARM64"), "ARM64");
    assert.equal(resolveForkWindowsExecutableName("T3 Code"), "T3 Code");
    assert.equal(resolveWindowsUnpackedExecutableName("0.0.24"), "ARM64.exe");
  });

  it("defaults desktop packaging product names to the ARM64 fork branding", () => {
    assert.equal(resolveDesktopProductName("0.0.17"), "ARM64");
    assert.equal(resolveDesktopProductName("0.0.17-nightly.20260413.42"), "T3 Code (Nightly)");
  });

  it("honors fork ARM64 desktop branding env overrides", () => {
    const previousProductName = process.env.T3CODE_DESKTOP_PRODUCT_NAME;
    const previousIconVariant = process.env.T3CODE_DESKTOP_ICON_VARIANT;
    process.env.T3CODE_DESKTOP_PRODUCT_NAME = "ARM64";
    process.env.T3CODE_DESKTOP_ICON_VARIANT = "arm64";
    try {
      assert.equal(resolveDesktopProductName("0.0.17"), "ARM64");
      assert.equal(resolveDesktopIconVariant(), "arm64");
      assert.equal(resolveDesktopArtifactName("0.0.17"), "ARM64-${version}-${arch}.${ext}");
      assert.deepStrictEqual(resolveDesktopBuildIconAssets("0.0.17"), {
        macIconPng: BRAND_ASSET_PATHS.arm64MacIconPng,
        linuxIconPng: BRAND_ASSET_PATHS.arm64LinuxIconPng,
        windowsIconIco: BRAND_ASSET_PATHS.arm64WindowsIconIco,
        windowsIconPng: BRAND_ASSET_PATHS.arm64WindowsIconPng,
      });
    } finally {
      if (previousProductName === undefined) {
        delete process.env.T3CODE_DESKTOP_PRODUCT_NAME;
      } else {
        process.env.T3CODE_DESKTOP_PRODUCT_NAME = previousProductName;
      }
      if (previousIconVariant === undefined) {
        delete process.env.T3CODE_DESKTOP_ICON_VARIANT;
      } else {
        process.env.T3CODE_DESKTOP_ICON_VARIANT = previousIconVariant;
      }
    }
  });

  it("defaults desktop packaging icons to the ARM64 fork artwork", () => {
    assert.deepStrictEqual(resolveDesktopBuildIconAssets("0.0.17"), {
      macIconPng: BRAND_ASSET_PATHS.arm64MacIconPng,
      linuxIconPng: BRAND_ASSET_PATHS.arm64LinuxIconPng,
      windowsIconIco: BRAND_ASSET_PATHS.arm64WindowsIconIco,
      windowsIconPng: BRAND_ASSET_PATHS.arm64WindowsIconPng,
    });

    assert.deepStrictEqual(resolveDesktopBuildIconAssets("0.0.17-nightly.20260413.42"), {
      macIconPng: BRAND_ASSET_PATHS.arm64MacIconPng,
      linuxIconPng: BRAND_ASSET_PATHS.arm64LinuxIconPng,
      windowsIconIco: BRAND_ASSET_PATHS.arm64WindowsIconIco,
      windowsIconPng: BRAND_ASSET_PATHS.arm64WindowsIconPng,
    });
  });

  it("omits bundled workspace packages from staged desktop dependencies", () => {
    assert.deepStrictEqual(
      resolveDesktopRuntimeDependencies(
        {
          "@effect/platform-node": "catalog:",
          "@t3tools/contracts": "workspace:*",
          "@t3tools/shared": "workspace:*",
          "@t3tools/ssh": "workspace:*",
          "@t3tools/tailscale": "workspace:*",
          effect: "catalog:",
          electron: "41.5.0",
        },
        {
          "@effect/platform-node": "4.0.0-beta.59",
          effect: "4.0.0-beta.59",
        },
      ),
      {
        "@effect/platform-node": "4.0.0-beta.59",
        effect: "4.0.0-beta.59",
      },
    );
  });

  it("falls back to the default mock update port when the configured port is blank", () => {
    assert.equal(resolveMockUpdateServerUrl(undefined), "http://localhost:3000");
    assert.equal(resolveMockUpdateServerUrl(4123), "http://localhost:4123");
  });

  it.effect("normalizes mock update server ports from env-style strings", () =>
    Effect.gen(function* () {
      assert.equal(yield* resolveMockUpdateServerPort(undefined), undefined);
      assert.equal(yield* resolveMockUpdateServerPort(""), undefined);
      assert.equal(yield* resolveMockUpdateServerPort("   "), undefined);
      assert.equal(yield* resolveMockUpdateServerPort("4123"), 4123);
    }),
  );

  it.effect("rejects non-numeric or out-of-range mock update ports", () =>
    Effect.gen(function* () {
      const invalidPorts = ["abc", "12.5", "0", "65536"];
      for (const port of invalidPorts) {
        const exit = yield* Effect.exit(resolveMockUpdateServerPort(port));
        assert.equal(exit._tag, "Failure");
      }
    }),
  );

  it.effect("preserves explicit false boolean flags over true env defaults", () =>
    Effect.gen(function* () {
      const resolved = yield* resolveBuildOptions({
        platform: Option.some("mac"),
        target: Option.none(),
        arch: Option.some("arm64"),
        buildVersion: Option.none(),
        outputDir: Option.some("release-test"),
        skipBuild: Option.some(false),
        keepStage: Option.some(false),
        signed: Option.some(false),
        verbose: Option.some(false),
        mockUpdates: Option.some(false),
        mockUpdateServerPort: Option.none(),
      }).pipe(
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromEnv({
              env: {
                T3CODE_DESKTOP_SKIP_BUILD: "true",
                T3CODE_DESKTOP_KEEP_STAGE: "true",
                T3CODE_DESKTOP_SIGNED: "true",
                T3CODE_DESKTOP_VERBOSE: "true",
                T3CODE_DESKTOP_MOCK_UPDATES: "true",
              },
            }),
          ),
        ),
      );

      assert.equal(resolved.skipBuild, false);
      assert.equal(resolved.keepStage, false);
      assert.equal(resolved.signed, false);
      assert.equal(resolved.verbose, false);
      assert.equal(resolved.mockUpdates, false);
    }),
  );
});
