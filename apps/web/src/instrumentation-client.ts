/**
 * Client-side Sentry initialization — loaded automatically by @sentry/nextjs
 * in the browser bundle. Same shared init + PII/secret scrubbing source as
 * the server/edge runtimes (src/lib/sentry.ts).
 */
import { initSentry } from "@/lib/sentry";

initSentry();
