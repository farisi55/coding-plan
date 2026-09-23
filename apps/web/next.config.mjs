import { withSentryConfig } from "@sentry/nextjs";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // OpenNext for Cloudflare builds via its own pipeline (no webpack config
  // mutation here) — Sentry's Next.js-on-Cloudflare support initializes the
  // SDK at runtime via instrumentation.ts, not via build-time server tweaks.
  sentry: {
    // Broaden the client bundle file set for sourcemap uploads; harmless when
    // no SENTRY_AUTH_TOKEN is present (uploads are skipped entirely).
    widenClientFileUpload: true,
    // Never block the production build if Sentry's release-registry calls
    // fail — deploys must not depend on Sentry availability.
    disableLogger: true,
    sourcemapDeleteTurbopackSourcemaps: true,
  },
};

// Org/project slugs come from env (set in CI/dashboard), never hardcoded.
// `silent` keeps CI logs clean; sourcemap uploads happen only when
// SENTRY_AUTH_TOKEN is provided in the environment.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
