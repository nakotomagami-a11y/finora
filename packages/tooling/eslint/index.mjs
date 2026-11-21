// The shared ESLint flat config. Rule ids that architecture §2 names are enforced here.
import { builtinModules } from "node:module";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import declaredWorkspaceDeps from "./rules/declared-workspace-deps.mjs";
import denylist from "./rules/denylist.mjs";

export const finoraPlugin = {
  meta: { name: "finora" },
  rules: { "declared-workspace-deps": declaredWorkspaceDeps, denylist },
};

const BARE_BUILTINS = builtinModules.filter((name) => !name.startsWith("_") && !name.startsWith("node:"));
const ENV_MESSAGE = "Read the environment through apps/server/src/env.ts, validated once at boot (architecture §2).";

export function finoraConfig() {
  return defineConfig(
    {
      ignores: [
        "**/node_modules/**",
        "**/.next/**",
        "**/dist/**",
        "**/coverage/**",
        ".data/**",
        "research/**",
        "docs/**",
        "scripts/guard/**",
      ],
    },
    {
      files: ["**/*.{js,mjs,ts,tsx,mts}"],
      languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
      plugins: { finora: finoraPlugin },
      rules: {
        "finora/declared-workspace-deps": "error",
        "finora/denylist": "error",
        "no-console": ["error", { allow: ["warn", "error"] }],
      },
    },
    {
      files: ["**/*.{ts,tsx,mts}"],
      extends: [tseslint.configs.recommended],
      rules: {
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
        ],
      },
    },
    {
      files: ["**/scripts/**/*.mjs", "packages/tooling/**/*.mjs"],
      rules: { "no-console": "off" },
    },
    {
      files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
      ignores: ["**/env.ts", "**/*.test.{ts,tsx}", "packages/tooling/**"],
      rules: {
        "no-restricted-properties": [
          "error",
          {
            object: "process",
            property: "env",
            message: ENV_MESSAGE,
          },
        ],
        // The forms no-restricted-properties cannot see (qa S01 #4).
        "no-restricted-syntax": [
          "error",
          { selector: "MemberExpression[object.name='process'][computed=true]", message: ENV_MESSAGE },
          { selector: "VariableDeclarator[init.name='process'] > ObjectPattern", message: ENV_MESSAGE },
          { selector: "AssignmentExpression[right.name='process'] > ObjectPattern", message: ENV_MESSAGE },
          { selector: "ImportDeclaration[source.value=/^(node:)?process$/] > ImportSpecifier[imported.name='env']", message: ENV_MESSAGE },
        ],
      },
    },
    {
      files: ["packages/domain/**/*.{ts,tsx}"],
      ignores: ["**/*.test.{ts,tsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [{ group: ["node:*"], message: "packages/domain is pure: no Node built-ins (architecture §2)." }],
            paths: BARE_BUILTINS.map((name) => ({
              name,
              message: "packages/domain is pure: no Node built-ins (architecture §2).",
            })),
          },
        ],
      },
    },
  );
}
