import { z } from "zod";

/**
 * Thin wrapper over OpenRouter's chat completions endpoint.
 * OpenRouter gives us one API key + one interface for many model providers
 * (OpenAI, Anthropic, Moonshot/Kimi, DeepSeek, Google, etc.) — so adding a
 * new model to the picker is a config change, not a new integration.
 */

export type SupportedModel = {
  id: string; // OpenRouter model slug, e.g. "anthropic/claude-opus-5"
  label: string; // shown in the UI dropdown
};

// Update this list as you want to expose more/fewer choices to users.
// Keep slugs in sync with https://openrouter.ai/models
export const SUPPORTED_MODELS: SupportedModel[] = [
  // All $0-cost — OpenRouter's Free Models Router + named :free variants.
  // Free-tier availability rotates (providers add/retire free slots), so
  // "Otomatis" is the most future-proof default: it auto-picks from
  // whatever's currently free rather than pointing at a slug that might
  // get retired. Check https://openrouter.ai/models?max_price=0 for the
  // current live list before assuming a specific named one still exists.
  { id: "openrouter/free", label: "Otomatis (gratis, dipilihkan sistem)" },
  { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1 (gratis)" },
  { id: "meta-llama/llama-3.2-3b-instruct:free", label: "Llama 3.2 (gratis)" },
];
// Rate limit on free models: 50 req/day per account (no cost), or 1,000/day
// after a one-time (non-recurring) $10 OpenRouter credit top-up. Quality is
// below the premium models (Claude/GPT/etc.) — acceptable trade-off for
// validating the MVP concept at $0; revisit for a paid tier later.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ---- Structured PRD shape -------------------------------------------------
// The model only produces name/phase/description; `id` (slug) and `status`
// are filled in deterministically by our backend after parsing — never trust
// an LLM to hand back stable identifiers or a consistent lifecycle status.

const subFeatureModelSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

const featureModelSchema = z.object({
  name: z.string().min(1),
  phase: z.number().int().min(1).max(4),
  subFeatures: z.array(subFeatureModelSchema).min(1).max(8),
});

const prdModelSchema = z.object({
  title: z.string().min(1),
  overview: z.string().min(1),
  features: z.array(featureModelSchema).min(1).max(10),
});

export type SubFeature = { id: string; name: string; description: string };
export type Feature = {
  id: string;
  name: string;
  phase: number;
  status: "planned";
  subFeatures: SubFeature[];
};
export type PrdContent = {
  title: string;
  overview: string;
  features: Feature[];
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Strip ```json fences models sometimes add despite instructions not to. */
function extractJsonBlock(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

const systemPrompt = `Kamu adalah asisten Product Manager. Ubah ide produk dari user menjadi rencana fitur yang terstruktur, siap dipakai AI coding agent.

Balas HANYA dengan JSON valid (tanpa markdown fence, tanpa komentar, tanpa teks lain di luar JSON), mengikuti skema persis ini:

{
  "title": "nama produk/fitur, singkat",
  "overview": "1-3 kalimat: masalah yang diselesaikan dan siapa penggunanya",
  "features": [
    {
      "name": "nama fitur",
      "phase": 1,
      "subFeatures": [
        { "name": "nama sub-fitur", "description": "1 kalimat: apa yang sub-fitur ini lakukan" }
      ]
    }
  ]
}

Aturan:
- "phase" adalah urutan prioritas pengerjaan (1 = paling inti/MVP, sampai 4 = paling akhir/nice-to-have). Boleh ada beberapa fitur di phase yang sama.
- Urutkan array "features" dari phase kecil ke besar.
- Minimal 3 fitur, tiap fitur minimal 2 sub-fitur.
- Tulis dalam Bahasa Indonesia yang jelas dan profesional. Jangan menyertakan field lain selain yang didefinisikan di skema.`;

export async function generatePrd(idea: string, modelId: string): Promise<{ content: PrdContent; tokensUsed: number }> {
  const isAllowed = SUPPORTED_MODELS.some((m) => m.id === modelId);
  if (!isAllowed) {
    throw new Error(`Model "${modelId}" is not in the allowed list`);
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      // Optional but recommended by OpenRouter for analytics/rate-limit attribution
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "coding-plan",
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: idea },
      ],
      temperature: 0.4,
      // Not all free-tier/open models honor response_format reliably, and
      // some providers reject requests with params they don't support. The
      // system prompt's explicit JSON instruction + extractJsonBlock()
      // below carry the real guarantee here, so we skip forcing this.
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawContent: string = data.choices?.[0]?.message?.content ?? "";
  const tokensUsed: number = data.usage?.total_tokens ?? 0;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonBlock(rawContent));
  } catch {
    throw new Error("Model tidak mengembalikan JSON yang valid. Coba generate ulang atau ganti model.");
  }

  const validated = prdModelSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(
      `Hasil AI tidak sesuai format yang diharapkan: ${validated.error.issues[0]?.message ?? "unknown validation error"}`
    );
  }

  // Fill in deterministic fields the LLM should never own: stable ids for
  // React keys / future linking, and lifecycle status (always "planned" for
  // a freshly generated PRD — status transitions are a separate feature).
  const content: PrdContent = {
    title: validated.data.title,
    overview: validated.data.overview,
    features: validated.data.features
      .slice()
      .sort((a, b) => a.phase - b.phase)
      .map((f) => ({
        id: slugify(f.name),
        name: f.name,
        phase: f.phase,
        status: "planned" as const,
        subFeatures: f.subFeatures.map((sf) => ({
          id: slugify(sf.name),
          name: sf.name,
          description: sf.description,
        })),
      })),
  };

  return { content, tokensUsed };
}
