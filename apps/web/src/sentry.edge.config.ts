/**
 * Edge runtime Sentry initialization — imported conditionally by
 * src/instrumentation.ts when NEXT_RUNTIME === "edge". Thin wrapper around
 * src/lib/sentry.ts so all runtimes share one init + scrubbing source.
 */
import { initSentry } from "@/lib/sentry";

initSentry();
