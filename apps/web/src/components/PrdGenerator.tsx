"use client";

import { useState } from "react";
import type { Feature, PrdContent, ApiResponse } from "@coding-plan/shared";

type ModelOption = { id: string; label: string };

// Feature/PrdContent (and its nested SubFeature) come from @coding-plan/shared
// now — this file used to define its own copy, silently disconnected from
// the actual shape openrouter.ts produces. That drift is exactly what the
// shared package exists to prevent.

const STATUS_LABEL: Record<Feature["status"], string> = {
  planned: "Direncanakan",
};

export default function PrdGenerator({ models }: { models: ModelOption[] }) {
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrdContent | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, idea, modelId }),
      });
      const body = (await res.json()) as ApiResponse<{ projectId: string; prd: { content: PrdContent } }>;

      if (!res.ok || body.error) {
        throw new Error(body.error?.message ?? "Gagal generate PRD.");
      }

      setResult(body.data.prd.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.");
    } finally {
      setLoading(false);
    }
  }

  // Group features by phase so the UI can render "Fase 1", "Fase 2"... sections,
  // each listing the features that belong to it.
  const featuresByPhase = result
    ? result.features.reduce<Record<number, Feature[]>>((acc, f) => {
        (acc[f.phase] ||= []).push(f);
        return acc;
      }, {})
    : {};
  const phaseNumbers = Object.keys(featuresByPhase)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-muted mb-1">Judul produk/fitur</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Aplikasi pencatat emas untuk investor ritel"
            className="w-full rounded-md border border-line bg-transparent px-3 py-2 text-paper placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">Ceritakan idemu</label>
          <textarea
            required
            minLength={20}
            rows={7}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Jelaskan masalah yang mau diselesaikan, target pengguna, dan fitur yang kamu bayangkan..."
            className="w-full rounded-md border border-line bg-transparent px-3 py-2 text-paper placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">Model AI</label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full rounded-md border border-line bg-ink px-3 py-2 text-paper focus:outline-none focus:ring-2 focus:ring-signal"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-signal px-4 py-2 font-medium text-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Membuat PRD..." : "Buat PRD"}
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      <div className="rounded-md border border-line p-5 min-h-[300px] space-y-6">
        {!result && <p className="text-muted text-sm">Hasil PRD akan muncul di sini setelah kamu generate.</p>}

        {result && (
          <>
            <div>
              <h2 className="font-display text-xl text-paper">{result.title}</h2>
              <p className="text-sm text-paper/80 mt-1">{result.overview}</p>
            </div>

            {phaseNumbers.map((phase) => (
              <div key={phase}>
                <h3 className="text-xs uppercase tracking-wide text-signal mb-2">Fase {phase}</h3>
                <div className="space-y-2">
                  {featuresByPhase[phase].map((feature) => (
                    <details key={feature.id} className="rounded-md border border-line group">
                      <summary className="cursor-pointer list-none flex items-center justify-between px-3 py-2">
                        <span className="text-paper font-medium">{feature.name}</span>
                        <span className="text-xs text-muted">{STATUS_LABEL[feature.status]}</span>
                      </summary>
                      <ul className="px-3 pb-3 space-y-2 border-t border-line pt-2">
                        {feature.subFeatures.map((sf) => (
                          <li key={sf.id} className="text-sm">
                            <span className="text-paper">{sf.name}</span>
                            <span className="text-muted"> — {sf.description}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
