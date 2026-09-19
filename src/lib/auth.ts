import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { getDb } from "./db";

// Cloudflare Workers blocks raw outbound SMTP (port 25/587) by default —
// this is standard anti-spam policy on basically every cloud/edge platform,
// not something specific to us. Resend's HTTP API sidesteps that entirely,
// and its free tier (3,000 emails/month, 100/day) comfortably covers
// magic-link volume at MVP scale.
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Returns a fresh NextAuthOptions object built with a live, request-scoped
 * D1-bound Prisma client. This can't be a static module-level export like
 * the old Vercel/Node version was — see src/lib/db.ts for why. Call this
 * inside each route/handler that needs it instead of importing a constant.
 */
export async function getAuthOptions(): Promise<NextAuthOptions> {
  const db = await getDb();

  return {
    adapter: PrismaAdapter(db),
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      }),
      EmailProvider({
        from: process.env.EMAIL_FROM,
        sendVerificationRequest: async ({ identifier: email, url }) => {
          const { error } = await resend.emails.send({
            from: process.env.EMAIL_FROM as string,
            to: email,
            subject: "Link login kamu",
            html: `<p>Klik link ini untuk masuk:</p><p><a href="${url}">${url}</a></p><p>Kalau kamu tidak minta ini, abaikan saja email ini.</p>`,
          });
          if (error) {
            throw new Error(`Gagal kirim email lewat Resend: ${error.message}`);
          }
        },
      }),
    ],
    session: {
      strategy: "database",
    },
    callbacks: {
      async session({ session, user }) {
        if (session.user) {
          (session.user as { id: string }).id = user.id;
          (session.user as { plan?: string }).plan = (user as { plan?: string }).plan;
        }
        return session;
      },
    },
    pages: {
      signIn: "/login",
    },
  };
}
