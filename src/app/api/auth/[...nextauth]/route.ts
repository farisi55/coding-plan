import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";

// Built fresh per request instead of once at module load — the adapter
// inside getAuthOptions() needs a live D1 binding, which only exists once
// a request is in flight (see src/lib/db.ts).
async function handler(req: Request) {
  const options = await getAuthOptions();
  return NextAuth(options)(req);
}

export { handler as GET, handler as POST };
