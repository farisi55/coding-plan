/**
 * Tests for the Sentry PII/secret scrubber (src/lib/sentry.ts).
 *
 * Covers Task #004's acceptance criterion: a test event containing a fake
 * email/token in its payload is scrubbed before send, verified against the
 * exact `scrubSentryEvent` function wired into every Sentry.init `beforeSend`
 * hook. All tests are isolated — pure functions, no network, no shared state,
 * nothing to tear down.
 */
import { describe, it, expect, afterEach } from "vitest";
import type { Transport } from "@sentry/core";
import { scrubSentryEvent, initSentry } from "./sentry";

/** Build a minimal valid Sentry error event with the given extra payload. */
function makeEvent(extra: Record<string, unknown>): Parameters<typeof scrubSentryEvent>[0] {
  return {
    // ErrorEvent's discriminant is `type: undefined` (per @sentry/core's
    // EventType union — 'transaction' | 'replay_event' | ... | undefined).
    type: undefined,
    event_id: "abc123def456abc123def456abc12345",
    level: "error",
    platform: "javascript",
    timestamp: 0,
    environment: "test",
    message: "test error",
    exception: {
      values: [{ type: "Error", value: "boom" }],
    },
    ...extra,
  };
}

describe("scrubSentryEvent (beforeSend hook)", () => {
  it("redacts a fake email in the event extra payload", () => {
    const event = scrubSentryEvent(
      makeEvent({ extra: { context: "user@example.com tried to log in" } })
    );
    const extra = event.extra as { context: string };
    expect(extra.context).not.toContain("user@example.com");
    expect(extra.context).toContain("[Filtered]");
  });

  it("redacts a fake token in the event extra payload", () => {
    // Fixture deliberately avoids real-world credential prefixes (e.g. the
    // "sk_live_" Stripe format) so secret-scanning push protection never
    // flags this file — 32+ base64url chars triggers the token scrubber.
    const fakeToken = "test-fixture-abcdefabcdefabcdefabcdef";
    const event = scrubSentryEvent(makeEvent({ extra: { auth: fakeToken } }));
    const extra = event.extra as { auth: string };
    expect(extra.auth).toBe("[Filtered]");
  });

  it("redacts values under sensitive keys regardless of content", () => {
    const event = scrubSentryEvent(
      makeEvent({ extra: { password: "harmless-looking", OPENROUTER_API_KEY: "value" } })
    );
    const extra = event.extra as Record<string, string>;
    expect(extra.password).toBe("[Filtered]");
    expect(extra.OPENROUTER_API_KEY).toBe("[Filtered]");
  });

  it("redacts emails nested deep inside request.data structures", () => {
    const event = scrubSentryEvent(
      makeEvent({
        request: { data: { title: "contact admin@site.org now", idea: "no pii here" } },
      })
    );
    const request = event.request as { data: { title: string; idea: string } };
    expect(request.data.title).not.toContain("admin@site.org");
    expect(request.data.idea).toBe("no pii here"); // untouched
  });

  it("redacts emails/tokens inside breadcrumb messages", () => {
    const event = scrubSentryEvent(
      makeEvent({
        breadcrumbs: [
          { message: "fetched https://api.test/v1 for owner+billing@corp.io", timestamp: 0 },
        ],
      })
    );
    const breadcrumbs = event.breadcrumbs as { message: string }[];
    expect(breadcrumbs[0].message).not.toContain("owner+billing@corp.io");
    expect(breadcrumbs[0].message).toContain("https://api.test/v1"); // non-PII survives
  });

  it("leaves normal error content untouched (no over-scrubbing)", () => {
    const event = scrubSentryEvent(
      makeEvent({ extra: { projectId: "short-id-1", attempt: 3 } })
    );
    const extra = event.extra as Record<string, unknown>;
    expect(extra.projectId).toBe("short-id-1");
    expect(extra.attempt).toBe(3);
  });

  it("never throws on cyclic structures", () => {
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic.self = cyclic;
    const event = scrubSentryEvent(makeEvent({ extra: { cyclic } }));
    expect(event.extra).toBeDefined();
  });

  it("bounds deep recursion instead of blowing the stack", () => {
    let deep: unknown = "leaf";
    for (let i = 0; i < 100; i++) {
      deep = { nested: deep };
    }
    const event = scrubSentryEvent(makeEvent({ extra: { deep } }));
    expect(event.extra).toBeDefined();
  });

  it("caps large arrays during traversal", () => {
    const big = Array.from({ length: 200 }, (_, i) => `item-${i}`);
    const event = scrubSentryEvent(makeEvent({ extra: { big } }));
    const extra = event.extra as { big: string[] };
    expect(extra.big.length).toBe(50);
  });

  it("keeps the non-sensitive parts of the event intact", () => {
    const event = scrubSentryEvent(makeEvent({}));
    expect(event.message).toBe("test error");
    expect(event.level).toBe("error");
    const values = event.exception?.values ?? [];
    expect(values[0]?.value).toBe("boom");
  });
});

describe("initSentry end-to-end capture (in-memory transport)", () => {
  // Captured envelope item texts from the in-memory transport — set up and
  // torn down by this suite only (isolated, no network). Capturing through a
  // real SDK client exercises the full pipeline: captureException →
  // _prepareEvent → beforeSend (scrubSentryEvent) → transport.send — so the
  // "captures an intentionally thrown test error" acceptance criterion is
  // verified end-to-end in CI without a live Sentry project.
  let envelopeTexts: string[] = [];

  afterEach(() => {
    envelopeTexts = [];
  });

  /**
   * Transport that records serialized envelope items instead of POSTing.
   * A transport receives an Envelope: [header, items] where each item is
   * [itemHeader, body] and body is the event JSON (verified against SDK v10).
   */
  function makeMemoryTransport(): Transport {
    return {
      send(request: unknown) {
        const items = (request as [unknown, unknown[]])[1] ?? [];
        for (const item of items) {
          const body = (item as [unknown, { body?: unknown }])[1]?.body ?? item;
          envelopeTexts.push(
            typeof body === "string" ? body : JSON.stringify(body)
          );
        }
        return Promise.resolve({ statusCode: 200 });
      },
      flush: () => Promise.resolve(true),
    };
  }

  it("captures an intentionally thrown error and delivers it through beforeSend scrubbing", async () => {
    const client = initSentry({
      dsn: "https://public@example.com/1", // fake DSN — in-memory transport, no network
      tracesSampleRate: 0,
      transport: makeMemoryTransport,
    });
    expect(client).not.toBeNull();

    // captureException/flush live on @sentry/core; the @sentry/nextjs server
    // entry re-exports only Next-specific capture helpers.
    const { captureException, flush } = await import("@sentry/core");
    const eventId = captureException(new Error("intentional test error"));
    expect(eventId).toBeDefined();

    await flush(2000);
    expect(envelopeTexts.length).toBeGreaterThan(0);
    const sent = envelopeTexts.join("\n");
    expect(sent).toContain("intentional test error");
  });

  it("scrubs a fake email before the event is delivered", async () => {
    initSentry({
      dsn: "https://public@example.com/1",
      tracesSampleRate: 0,
      transport: makeMemoryTransport,
    });

    const { captureException, flush } = await import("@sentry/core");
    captureException(new Error("contact victim@example.com about the failure"));
    await flush(2000);

    expect(envelopeTexts.length).toBeGreaterThan(0);
    const sent = envelopeTexts.join("\n");
    expect(sent).not.toContain("victim@example.com");
    expect(sent).toContain("[Filtered]");
  });

  it("is a no-op when no DSN is configured (disabled by default)", () => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const client = initSentry();
    expect(client).toBeNull();
  });
});
