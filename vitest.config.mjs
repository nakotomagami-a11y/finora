import { defineConfig } from "vitest/config";
import { finoraVitest } from "@finora/tooling/vitest";

// apps/web keeps `"jsx": "preserve"` for Next, which Vite cannot run: a component test transforms its JSX itself.
export default defineConfig({ ...finoraVitest, oxc: { jsx: { runtime: "automatic" } } });
