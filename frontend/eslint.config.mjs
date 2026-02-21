import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React 19 compiler rules currently flag a large set of legacy effect patterns.
      // Keep these disabled for launch hardening; re-enable after targeted refactors.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      // Existing editor code uses dynamic command payloads; typed cleanup is tracked post-launch.
      "@typescript-eslint/no-explicit-any": "off",
      // Rich editor preview uses raw img tags in several controlled contexts.
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "public/sw.js",
    "public/sw.js.map",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
