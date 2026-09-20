# coding-plan (MVP)

SaaS untuk mengubah ide produk menjadi PRD siap pakai untuk AI coding agent, dengan pilihan multi-model AI lewat OpenRouter.

**Stack ini didesain buat jalan $0/bulan** (kecuali domain) di Cloudflare free tier. Lihat `developer-brief-web-app.md` untuk detail lengkap & trade-off tiap keputusan.

## Stack

- Next.js 15 (App Router) + TypeScript
- **Cloudflare Workers** (hosting, via `@opennextjs/cloudflare`) + **Cloudflare D1** (database, SQLite via Prisma driver adapter)
- NextAuth.js (Google OAuth + Email magic link via **Resend HTTP API** — bukan SMTP, Cloudflare blokir port SMTP)
- OpenRouter — default ke model **`:free`** ($0, rate limit 50 req/hari) — lihat `src/lib/openrouter.ts`
- Tailwind CSS

## Setup

```bash
npm install

# 1. Buat D1 database (sekali saja), lalu tempel database_id yang dicetak ke wrangler.jsonc
npx wrangler d1 create prd-generator-db

# 2. Generate migration SQL dari schema Prisma, terapkan ke D1 lokal
npx prisma generate
npx wrangler d1 migrations create prd-generator-db init
# (salin SQL hasil `prisma migrate diff` ke file migration yang dibuat wrangler — lihat
#  https://opennext.js.org/cloudflare/howtos/db untuk contoh persis)
npm run prisma:migrate          # apply ke D1 lokal
npm run cf:typegen              # generate types untuk binding env.DB

cp .env.example .env            # isi GOOGLE_CLIENT_ID/SECRET, RESEND_API_KEY, OPENROUTER_API_KEY
npm run dev
```

Buka http://localhost:3000

## Dev tooling

```bash
npm run lint          # ESLint
npm run format        # Prettier — auto-fix
npm run format:check  # Prettier — check only (buat CI)
npm run test           # Vitest, sekali jalan
npm run test:watch     # Vitest, watch mode
npm run test:coverage  # Vitest + laporan coverage (target: >80%, lihat vitest.config.ts)
```


**Deploy ke Cloudflare** (setelah setup di atas jalan lokal):
```bash
npm run prisma:migrate:remote   # apply migration ke D1 production
npm run cf:deploy               # build + deploy ke Workers
```

## Cara kerja generate PRD

1. User isi judul + deskripsi ide, pilih model AI dari dropdown (`src/lib/openrouter.ts` — `SUPPORTED_MODELS`)
2. Request masuk ke `POST /api/generate` (`src/app/api/generate/route.ts`)
   - Validasi input (zod)
   - Cek kuota bulanan sesuai plan user (FREE/STARTER/PRO)
   - Buat `Project`, panggil OpenRouter, simpan hasil sebagai `Prd` (JSON terstruktur)
3. Hasil dirender di UI (`src/components/PrdGenerator.tsx`) sebagai daftar fitur yang dikelompokkan per Fase, tiap fitur bisa di-expand untuk lihat sub-fiturnya

### Struktur output PRD

Model diminta balas JSON (bukan markdown bebas), divalidasi dengan zod di `src/lib/openrouter.ts` sebelum disimpan:

```json
{
  "title": "string",
  "overview": "string",
  "features": [
    {
      "id": "slug",          // dibuat backend, bukan dari LLM
      "name": "string",
      "phase": 1,             // 1 = MVP inti, 4 = nice-to-have
      "status": "planned",   // dibuat backend, bukan dari LLM
      "subFeatures": [
        { "id": "slug", "name": "string", "description": "string" }
      ]
    }
  ]
}
```

`id` dan `status` sengaja tidak diminta dari LLM — di-generate deterministik di backend (`slugify` + default `"planned"`) supaya konsisten dan tidak gampang di-drift oleh model yang beda-beda.

## Biaya (target: $0/bulan)

| Layanan | Free tier | Cukup buat MVP? |
|---|---|---|
| Cloudflare Workers | 100K request/hari | Ya |
| Cloudflare D1 | 5GB + 5M read/write/bulan | Ya |
| Resend | 3.000 email/bulan, 100/hari | Ya |
| OpenRouter `:free` models | 50 request/hari (1.000/hari kalau pernah top-up $10 sekali) | Ya untuk testing/validasi awal |
| Google OAuth | Gratis selalu | Ya |
| Domain | — | Dibeli terpisah, di luar cakupan ini |

**Catatan D1:** tidak dukung transaction asli (Prisma jalanin `$transaction()` sebagai query terpisah). Kode di repo ini sudah didesain tanpa bergantung pada transaction, jadi bukan masalah saat ini — tapi kalau nambah fitur baru yang butuh atomicity beberapa tabel sekaligus, perlu direview ulang.

## Yang belum diimplementasi (next steps)

- [ ] Halaman riwayat project (list semua PRD yang pernah dibuat user)
- [ ] Export PRD ke `.md` file / PDF
- [ ] Payment integration (**Xendit**, dikonfirmasi) untuk upgrade plan — sengaja ditunda sesuai keputusan awal
- [ ] Rate limiting di level middleware (saat ini hanya quota check per-request + rate limit bawaan OpenRouter free tier)
- [ ] Regenerate satu fitur/sub-fitur tertentu tanpa generate ulang semuanya
- [ ] Visualisasi node-graph (saat ini list per-fase yang bisa di-expand, bukan graph interaktif)
- [ ] Wizard klarifikasi sebelum generate, fitur sync codebase eksisting (CLI terpisah — lihat `developer-brief-cli-tool.md`), Workspace Agent chat (butuh Vectorize) — semua ini scope final app, bukan MVP
- [ ] Endpoint CLI auth (`/api/cli-auth/start` + callback) yang menerbitkan `CliToken` — model schema-nya sudah ada, endpoint-nya belum
- [ ] Privacy notice + rencana respons insiden 3×24 jam (UU PDP) — lihat `prd.md` §6.4
- [ ] Scheduled job (Cloudflare Cron Trigger) buat retention 3 bulan — hapus akun tidak aktif berdasarkan `User.lastActiveAt` (field sudah ada, job belum); email peringatan dikirim 30 hari sebelum penghapusan (dikonfirmasi)

## Menambah model AI baru

Tinggal tambah entry di `SUPPORTED_MODELS` (`src/lib/openrouter.ts`) dengan slug OpenRouter yang valid — tidak perlu ubah kode lain.
