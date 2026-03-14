import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Disabled: this rule flags legitimate patterns used throughout the app —
      // SSR mount detection (ThemeToggle), filter-driven pagination resets, and
      // AI stream syncing (ai-clinical-chat, visit-note-editor). All are
      // intentional and do not cause cascading renders.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
