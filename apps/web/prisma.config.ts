import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7+ no longer loads .env automatically for the CLI (prisma generate,
// prisma studio, etc.) — this file replaces that, and is CLI-only. It has no
// effect on the actual running app: runtime D1 access goes through the
// getCloudflareContext() binding in src/lib/db.ts, never through
// DATABASE_URL. DATABASE_URL here is only the placeholder schema.prisma's
// datasource block wants to see so `prisma generate` doesn't error — see the
// comment in .env.example.
export default defineConfig({
  schema: "prisma/schema.prisma",
  // Placeholder only — satisfies Prisma 7's schema validation for the CLI.
  // Never read at runtime: D1 is a binding (src/lib/db.ts), not a URL.
  datasource: {
    url: "file:./dev.db",
  },
});
