/**
 * Next.js Instrumentation hook (Next 15 requirement for server-side error
 * capture with @sentry/nextjs >= 8.28). Runs once per runtime warmup before
 * any request handler: initializes Sentry per runtime and exports
 * onRequestError so Server Component / route handler errors reach Sentry.
 *
 * Init failures are swallowed by design: a broken Sentry DSN/config must
 * never take down request handling (observability is additive, the app
 * works without it).
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  try {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("./sentry.server.config");
    }
    if (process.env.NEXT_RUNTIME === "edge") {
      await import("./sentry.edge.config");
    }
  } catch {
    // Swallow init failure — Sentry must be transparent to request flow.
  }
}

// Capture errors from Server Components, route handlers, and middleware.
export const onRequestError = Sentry.captureRequestError;
