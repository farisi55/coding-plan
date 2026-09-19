import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { getAuthOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { generatePrd, SUPPORTED_MODELS } from "@/lib/openrouter";
import { apiOk, apiError } from "@/lib/api-response";

const requestSchema = z.object({
  title: z.string().min(3).max(120),
  idea: z.string().min(20, "Jelaskan idemu minimal 20 karakter").max(4000),
  modelId: z.enum(SUPPORTED_MODELS.map((m) => m.id) as [string, ...string[]]),
});

// Simple monthly quota per plan. Adjust once pricing tiers are finalized.
const MONTHLY_QUOTA: Record<string, number> = {
  FREE: 3,
  STARTER: 30,
  PRO: 200,
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(await getAuthOptions());
  if (!session?.user) {
    return apiError("UNAUTHORIZED", "Kamu harus login dulu.", 401);
  }

  const userId = (session.user as { id: string }).id;
  const db = await getDb();

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Input tidak valid.", 400, parsed.error.flatten());
  }
  const { title, idea, modelId } = parsed.data;

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

  // Reset quota if we've rolled into a new month
  const now = new Date();
  let generationsThisMonth = user.generationsThisMonth;
  if (now > user.quotaResetAt) {
    generationsThisMonth = 0;
  }

  const quota = MONTHLY_QUOTA[user.plan] ?? MONTHLY_QUOTA.FREE;
  if (generationsThisMonth >= quota) {
    return apiError(
      "QUOTA_EXCEEDED",
      `Kuota generate bulanan (${quota}) untuk plan ${user.plan} sudah habis.`,
      429
    );
  }

  const project = await db.project.create({
    data: { userId, title, idea, status: "GENERATING" },
  });

  try {
    const { content, tokensUsed } = await generatePrd(idea, modelId);

    const prd = await db.prd.create({
      data: {
        projectId: project.id,
        modelUsed: modelId,
        content,
        tokensUsed,
      },
    });

    await db.project.update({
      where: { id: project.id },
      data: { status: "DONE" },
    });

    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await db.user.update({
      where: { id: userId },
      data: {
        generationsThisMonth: generationsThisMonth + 1,
        quotaResetAt: now > user.quotaResetAt ? nextReset : user.quotaResetAt,
      },
    });

    return apiOk({ projectId: project.id, prd });
  } catch (err) {
    await db.project.update({
      where: { id: project.id },
      data: { status: "FAILED" },
    });
    const message = err instanceof Error ? err.message : "Unknown error";
    return apiError("GENERATION_FAILED", message, 502);
  }
}
