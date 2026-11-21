import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Nothing in the app uses next/image, and the image route would be one more path outside the guard.
  images: { unoptimized: true },
  // Next.js writes an AGENTS.md of its own rules into the app folder; the repo has its own agent instructions.
  agentRules: false,
  // Workspace packages export TypeScript source, so Next compiles them.
  transpilePackages: ["@finora/api-contract", "@finora/domain", "@finora/i18n", "@finora/server", "@finora/ui"],
};

export default withNextIntl(nextConfig);
