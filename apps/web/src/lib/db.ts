import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Cloudflare Workers has no persistent top-level `process.env` the way a
 * long-running Node server does — each request gets its own `env` bindings
 * (D1, KV, etc.) handed to it. That means the old singleton pattern
 * (`export const prisma = new PrismaClient()` at module load time) doesn't
 * work here: there's no D1 binding available yet when the module first
 * loads. Instead, call `getDb()` inside each request/route handler.
 *
 * `cache()` from React memoizes this per-request when called from a Server
 * Component, so multiple calls within the same request reuse one client.
 */
export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  const adapter = new PrismaD1(env.DB);
  return new PrismaClient({ adapter });
}
