import { getServerSession } from "next-auth";
import Link from "next/link";
import { getAuthOptions } from "@/lib/auth";
import { SUPPORTED_MODELS } from "@/lib/openrouter";
import PrdGenerator from "@/components/PrdGenerator";

export default async function HomePage() {
  const session = await getServerSession(await getAuthOptions());

  if (!session?.user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
        <h1 className="font-display text-4xl md:text-5xl max-w-2xl">
          Dari ide mentah, jadi PRD yang siap dikerjakan AI coding agent.
        </h1>
        <p className="text-muted max-w-md">
          Tulis idemu, pilih model AI, dapatkan spec, user story, dan task breakdown dalam hitungan detik.
        </p>
        <Link
          href="/api/auth/signin"
          className="rounded-md bg-signal px-6 py-3 font-medium text-ink hover:brightness-110"
        >
          Masuk untuk mulai
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="font-display text-2xl">coding-plan</h1>
        <span className="text-sm text-muted">{session.user.email}</span>
      </header>
      <PrdGenerator models={SUPPORTED_MODELS} />
    </main>
  );
}
