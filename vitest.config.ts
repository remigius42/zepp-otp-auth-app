import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    /* The phone-side `i18n` module exists only inside the Zepp app. */
    alias: {
      i18n: fileURLToPath(
        new URL("./src/shared/__tests__/support/i18n.ts", import.meta.url)
      )
    }
  },
  test: {
    globals: true,
    include: ["src/**/__tests__/**/*.spec.ts", "bin/**/__tests__/**/*.spec.*"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      excludeAfterRemap: true,
      exclude: [
        "src/**/__tests__/**",
        // Imperative @zos/ui widget construction and Settings App render
        // functions have no test seam on this platform. Excluded explicitly so
        // the untestable surface stays visible in review rather than being
        // averaged away — see docs/ZEPP_OS_PORTING_ANALYSIS.md §6.3.
        "src/page/index.ts",
        "src/page/index.r.layout.ts",
        "src/setting/index.ts",
        // Entry-point shims. These only register a lifecycle object with a Zepp
        // global, so there is nothing to assert. Keep them shims: anything
        // worth testing belongs in a module under src/shared/ instead.
        "src/app.ts",
        "src/app-side/index.ts",
        // Engine polyfills. Their whole point is a branch that is never taken
        // on Node, where the built-ins already exist; bin/check-engine.mjs
        // verifies them against the device's engine instead.
        "src/shared/enginePolyfills.ts",
        // Type-only modules. They emit no runtime code, so v8 reports 0/0
        // statements as 0% and trips the per-file threshold.
        "src/shared/AppSettings.ts",
        "src/shared/PeerMessage.ts",
        "src/shared/TotpConfig.ts",
        "src/global.d.ts"
      ],
      thresholds: {
        perFile: true,
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  }
})
