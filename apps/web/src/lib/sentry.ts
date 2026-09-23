/**
 * Central Sentry initialization for coding-plan.
 *
 * One `Sentry.init()` source of truth, parameterized per runtime (node / edge
 * / browser) by `initSentry()` — the three config entrypoints
 * (sentry.server.config.ts, sentry.edge.config.ts, instrumentation-client.ts)
 * are thin wrappers around this module so DSN, sample rates, and the PII
 * scrubber (scrubSentryEvent) can never drift between runtimes.
 *
 * PII/secret scrubbing (this task's core requirement): every outbound event
 * passes through `beforeSend` → `scrubSentryEvent()`, which strips emails,
 * token-like strings, and sensitive-keyed values BEFORE the event leaves the
 * process — per knowledge.md §9 and UU PDP, PII must never reach Sentry.
 */

import * as Sentry from "@sentry/nextjs";

/** Keys whose values are always stripped from events, case-insensitive. */
const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|authorization|auth|cookie|apikey|api_key|api-key|credential|session|ssn|nik|email)/i;

/**
 * Strings that look like credentials/PII: long hex/base64url blobs
 * (tokens, hashed keys) and email addresses. Intentionally simple — no
 * nested quantifiers, no catastrophic backtracking risk (knowledge.md §9
 * regex policy). emailOrHex matches exactly one of its alternatives.
 */
const EMAIL_OR_TOKEN_PATTERN = new RegExp(
  [
    "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", // email addresses
    "\\b[0-9a-f]{16,64}\\b", // long lowercase hex blobs (ids, digests, tokens)
    "\\b[A-Za-z0-9_-]{32,}\\b", // base64url-ish opaque tokens
  ].join("|"),
  "g"
);

/** Replacement marker written in place of every scrubbed value. */
const REDACTED = "[Filtered]";

/** True when a value's key (or the value itself) looks sensitive. */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

/**
 * Scrub one primitive value: redact token-like/email-like strings entirely,
 * and strip emails/tokens appearing inside longer natural-language strings.
 * Returns the value unchanged when it looks harmless.
 */
function scrubValue(value: string): string {
  if (isSensitiveKey(value) && value.length <= 128) {
    return REDACTED;
  }
  return value.replace(EMAIL_OR_TOKEN_PATTERN, REDACTED);
}

/**
 * Recursively scrub an event structure in place: redact sensitive-keyed
 * properties, prune non-sensitive objects beyond maxDepth to bound worker
 * CPU time (knowledge.md §9: 10ms CPU/request on Workers Free), and cap
 * array traversal. Cycles are handled via the seen set.
 */
function scrubStructure(node: unknown, depth: number, seen: Set<object>): unknown {
  if (node === null || typeof node !== "object") {
    return typeof node === "string" ? scrubValue(node) : node;
  }
  if (seen.has(node as object) || depth > 6) {
    return "[Truncated]";
  }
  seen.add(node as object);

  if (Array.isArray(node)) {
    return node.slice(0, 50).map((item) => scrubStructure(item, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      out[key] = REDACTED;
    } else {
      out[key] = scrubStructure(value, depth + 1, seen);
    }
  }
  return out;
}

/**
 * Sentry `beforeSend` hook: scrub PII/secrets from an event before it is
 * sent. Exported for unit testing (acceptance criterion: scrubbing verified
 * via this hook) and wired into every Sentry.init call from initSentry().
 */
export function scrubSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  return scrubStructure(event, 0, new Set()) as Sentry.ErrorEvent;
}

/** Resolve the runtime's Sentry config from environment variables. */
function resolveSentryOptions(dsnOverride?: string): Sentry.BrowserOptions | null {
  const dsn = dsnOverride ?? process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  // No DSN configured → error tracking disabled; init must be a no-op so
  // local dev and CI never fail for lack of Sentry credentials.
  if (!dsn) return null;

  // Sample rates default to 100% on errors; traces at 10% prod / 100% dev.
  const tracesSampleRate = process.env.NODE_ENV === "development" ? 1.0 : 0.1;

  return {
    dsn,
    tracesSampleRate,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // PII/secret scrubbing is non-negotiable (UU PDP) — every event passes
    // through scrubSentryEvent before leaving the process.
    beforeSend: scrubSentryEvent,
  };
}

/**
 * Initialize Sentry for the current runtime. Idempotent and side-effect
 * free when SENTRY_DSN is unset; returns the Sentry namespace so callers
 * can re-export captureRequestError etc. from their own module scope.
 *
 * `overrides` lets tests inject an in-memory transport (no network) and
 * tune sample rates; production callers never pass it.
 */
export function initSentry(
  overrides?: Partial<Sentry.BrowserOptions>
): typeof Sentry | null {
  const options = resolveSentryOptions(overrides?.dsn);
  if (!options) return null;
  Sentry.init({ ...options, ...overrides });
  return Sentry;
}
