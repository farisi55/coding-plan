---
project: coding-plan
version: 1.0.4
source: prd
last_updated: 2026-09-23
project_shape: fullstack
simple_mode: false
external_assets: false
---
# simple_mode: false — 6-month target 100 pengunjung/bulan (≤100, syarat 1 terpenuhi), TAPI §6.4 PRD eksplisit menyatakan UU PDP berlaku (bukan "none") — kedua syarat wajib true, syarat 2 gagal
# external_assets: false — shape fullstack punya UI, tapi §4.6 PRD cuma referensi Google Fonts (Fraunces/Inter/JetBrains Mono, freely-loadable) + hex color code — tidak ada foto/logo client atau font berlisensi

## 1. Project Identity
- **Nama:** coding-plan — mengubah ide produk (atau codebase eksisting) jadi PRD terstruktur Fase→Fitur→Sub-fitur yang siap dieksekusi AI coding agent
- **Primary users:** Solo developer, tim kecil, technical founder MSME yang pakai AI coding agent (Claude Code, Cursor, Codex, dll)
- **Project Shape:** fullstack — implikasi ke Phase Applicability Matrix (PRD §9): Phase 2 (Domain & Data) applies karena database bukan "none"; Phase 4 (Integration) applies karena ada third-party services; Phase 5 (UI/UX) applies karena shape punya UI; phase lain applies always
- **External API consumers:** Ya — CLI companion tool (proyek terpisah) konsumsi endpoint auth/bootstrap dan ingest-summary

## 2. Tech Stack
- **Language:** TypeScript 5.x, runtime Node.js via Cloudflare Workers `nodejs_compat`
- **Framework:** Next.js 15.5.25, App Router (bumped from 15.1.6 — `@opennextjs/cloudflare@1.x` requires `>=15.5.24`)
- **Database:** Cloudflare D1 (SQLite) via Prisma 7.10.0 (upgraded from 5.20.0 — `@prisma/adapter-d1` doesn't exist for the 8.x RC yet, so 7.10.0 is the current stable ceiling). Generator changed to `provider = "prisma-client"` with `output = "../src/generated/prisma"` (required as of v7 — no longer generates into `node_modules`) and `engineType = "client"` (no Rust query-engine binary at all — GA since 6.16.0, the right call for a Workers deployment). Import path changed accordingly: `from "../generated/prisma/client"`, not `from "@prisma/client"`. Datasource `url` moved out of `schema.prisma` into `prisma.config.ts` (deprecated in-schema as of v7); still just a placeholder either way since runtime never reads it. **Not verified end-to-end** — `prisma generate` cannot complete in this sandbox (blocked fetching its schema-engine binary from `binaries.prisma.sh`, outside the network allowlist); syntax is research-backed but unconfirmed. Run `npm install && npx prisma generate` on a real machine before trusting this.
- **Infrastructure:** Cloudflare Workers via `@opennextjs/cloudflare@^1.0.0` (bumped from a broken `^0.6.0` pin — see Task #001 Notes) + `wrangler@^4.125.0` (bumped from `^3.99.0`, required peer dependency). Workers `compatibility_date` = `2025-08-16` (bumped from `2025-01-01` in Task #004 — REQUIRED by Sentry's Next.js-on-Workers support: introduces `https.request` to the runtime, which Sentry needs to send events; do not lower). `wrangler.jsonc` `vars` carries non-secret runtime config (`SENTRY_DSN`, `SENTRY_ENVIRONMENT`); secrets stay in `wrangler secret put` / dashboard.
- **Error tracking:** Sentry via `@sentry/nextjs@10.75.2` (exact-pinned; initialized in Task #004). Runtime-init pattern for OpenNext Workers (officially supported, requires the 2025-08-16 compatibility date): shared init + PII/secret scrubber in `src/lib/sentry.ts` (`initSentry()`, `scrubSentryEvent()` via `beforeSend`), wired per runtime by `src/instrumentation.ts` (`register()` + `onRequestError` → `sentry.server.config.ts` / `sentry.edge.config.ts` / `instrumentation-client.ts`), `next.config.mjs` wrapped in `withSentryConfig` (org/project/authToken all env-driven; `silent: true`; sourcemap uploads only when `SENTRY_AUTH_TOKEN` present). No-DSN ⇒ no-op init (dev/CI unaffected). Captures verified via in-memory transport in unit tests (no live Sentry project needed).
- **Container orchestration:** none
- **Key third-party services:** OpenRouter (AI gateway, model `:free`), Cloudflare Vectorize + Workers AI (RAG Workspace Agent chat — belum diimplementasi), Resend (email, HTTP API), Sentry (error tracking — diimplementasi Task #004), Xendit (payment gateway — belum diimplementasi)
- **Webhook providers:** Xendit (konfirmasi pembayaran) — belum diimplementasi

## 3. Architecture
- **Pattern:** Serverless (Cloudflare Workers) + Next.js App Router — route handlers sebagai API layer, server components untuk SSR
- **Folder/module structure:**
  ```
  coding-plan/                    # npm workspaces monorepo root
  ├── developer-brief-web-app.md, developer-brief-cli-tool.md
  ├── apps/web/                    # this unit — everything below is inside it
  │   ├── .husky/pre-commit → moved to repo root, applies to all workspaces
  │   ├── prisma/schema.prisma
  │   ├── src/
  │   │   ├── app/
  │   │   │   ├── api/{auth/[...nextauth],generate}/route.ts
  │   │   │   ├── layout.tsx, page.tsx, globals.css
  │   │   ├── components/PrdGenerator.tsx
  │   │   ├── instrumentation.ts           # Next instrumentation hook: per-runtime Sentry init + onRequestError
  │   │   ├── instrumentation-client.ts     # client runtime Sentry init
  │   │   ├── sentry.server.config.ts       # nodejs runtime Sentry init
  │   │   ├── sentry.edge.config.ts         # edge runtime Sentry init
  │   │   └── lib/{auth,db,openrouter,api-response,sentry}.ts
  │   ├── cloudflare-env.d.ts      # bridges wrangler's generated Env into CloudflareEnv
  │   ├── wrangler.jsonc, open-next.config.ts, next.config.mjs
  │   └── prd.md, knowledge.md, changelog.md   # this unit's own planning docs
  └── packages/
      ├── shared/src/index.ts      # ApiError/ApiResponse/PrdContent/Feature/SubFeature — the actual web↔CLI contract
      └── cli/                     # not yet implemented — see developer-brief-cli-tool.md
  ```
  Monorepo decided over separate repos (2026-09-20): shared TypeScript contract with the future CLI outweighs the overhead of two repos for a solo developer. `.gitignore`/`.husky/` live at the workspace root, not inside `apps/web`, since git hooks are repo-wide regardless of which workspace changed.
- **Design patterns:** Zod validation di API boundary; per-request resource factory (`getDb()`, `getAuthOptions()`) — bukan singleton Node tradisional
- **Data flow:** client → Next.js Route Handler → validasi zod → Prisma (D1) / OpenRouter → response JSON (`{ data, error }` envelope)
- **Key architectural decisions:**
  1. Cloudflare Workers + D1 dipilih di atas Vercel + Postgres — target hosting $0/bulan; trade-off: D1 tidak dukung transaction asli
  2. Prisma client per-request (`getDb()`) dipilih di atas singleton module-level — binding D1 cuma tersedia dalam konteks request, Workers tidak punya state persisten antar-request
  3. Model AI `:free` dipilih di atas model premium untuk MVP — target biaya inference $0; trade-off: kualitas lebih rendah, rate limit 50 request/hari
  4. Output PRD terstruktur (JSON Fase→Fitur→Sub-fitur) dipilih di atas markdown freeform — lebih actionable buat AI coding agent
  5. Resend (HTTP API) dipilih di atas SMTP — Cloudflare Workers memblokir outbound SMTP port 25/587 by default
  6. Monorepo (npm workspaces: apps/web + packages/shared + packages/cli) dipilih di atas 2 repo terpisah — shared TypeScript contract (response envelope, PRD structure) dengan CLI di masa depan mengalahkan overhead 2-repo buat solo developer; per-unit `prd.md`/`knowledge.md`/`changelog.md` tetap terpisah (Appendix I tetap berlaku di level dokumen, cuma tooling/repo-nya yang digabung)
  7. Prisma `engineType = "client"` (no Rust binary) dipilih di atas default engine — cocok buat Workers (bundle lebih kecil, nggak ada binary native yang perlu di-fetch/ship saat runtime); trade-off: CLI (`prisma generate`) tetap butuh schema-engine buat operasinya sendiri, jadi ini nggak menghilangkan kebutuhan network access saat development, cuma menghilangkan binary dari RUNTIME bundle

## 4. Code Standards
- **Naming:** file kebab-case, function camelCase, class/type PascalCase
- **Formatter:** Prettier
- **Linter:** ESLint + `@typescript-eslint` + `eslint-config-next`
- **Testing:** Vitest, coverage target >80% (lines/functions/branches/statements)
- **Docstring:** one-line purpose comment di atas tiap exported function/class/method — hidup di kode, bukan diduplikasi ke sini

## 5. API & Data Contracts
- **Base URL:** `/api/` — belum ada versioning path eksplisit
- **API versioning:** none saat ini; backward-compat ASSUMED additive-only (karena ada CLI sebagai external consumer)
- **Rate limiting store:** none di level app — mengandalkan rate limit bawaan OpenRouter free tier (50/hari)
- **Authentication:** Web — session database-backed (NextAuth). CLI — OAuth browser-based, backend tampilkan URL callback berisi token sekali-tukar untuk di-copy-paste ke terminal; token opaque (bukan JWT) disimpan sebagai hash di `CliToken.tokenHash`
- **Webhook inbound verification:** skema spesifik untuk Xendit belum didefinisikan — webhook belum diimplementasi
- **Response envelope:** `{ data: T | null, error: { code, message, details? } | null }` — **catatan: `request_id` belum ada di skema saat ini**, belum diputuskan
- **Request/response contoh:** `POST /api/generate` — request `{ title, idea, modelId }`; response `{ data: { projectId, prd }, error: null }` atau `{ data: null, error: {...} }`
- **Pagination:** none — belum ada endpoint list

## 6. UI / UX Constraints
- **Component library:** Tailwind CSS (utility-first) — bukan design system/component library terpisah

### Design Tokens
- **Color palette:** `ink` #12181F (background), `paper` #F6F4EF (teks/panel), `signal` #E8B34B (CTA/highlight, dipakai sparingly), `line` #2A323C (border), `muted` #8A94A3 (teks sekunder)
- **Typography:** Fraunces (serif, display/heading), Inter (sans, body), JetBrains Mono (kode/mono)
- **Visual direction:** Dark-mode-first, minimal, aesthetic developer-tool

## 7. Business Logic & Domain Rules

### Data Schema
```
Entity: User
  - id: String (cuid) — PRIMARY KEY
  - name: String, nullable
  - email: String, NOT NULL, unique
  - emailVerified: DateTime, nullable
  - image: String, nullable
  - plan: String, NOT NULL, default: "FREE" (valid: FREE | STARTER | PRO — divalidasi zod)
  - generationsThisMonth: Int, NOT NULL, default: 0
  - quotaResetAt: DateTime, NOT NULL, default: now()
  - lastActiveAt: DateTime, NOT NULL, default: now()
  - createdAt: DateTime, NOT NULL, default: now()
  Indexes: email (unique)
```
```
Entity: Account
  - id: String (cuid) — PRIMARY KEY
  - userId: String, NOT NULL
  - type, provider, providerAccountId: String, NOT NULL
  - refresh_token, access_token, id_token: String, nullable
  - expires_at: Int, nullable
  - token_type, scope, session_state: String, nullable
  Foreign keys: userId → User.id ON DELETE CASCADE
  Indexes: (provider, providerAccountId) unique
```
```
Entity: Session
  - id: String (cuid) — PRIMARY KEY
  - sessionToken: String, NOT NULL, unique
  - userId: String, NOT NULL
  - expires: DateTime, NOT NULL
  Foreign keys: userId → User.id ON DELETE CASCADE
  Indexes: sessionToken (unique)
```
```
Entity: VerificationToken
  - identifier: String, NOT NULL
  - token: String, NOT NULL, unique
  - expires: DateTime, NOT NULL
  Indexes: (identifier, token) unique, token (unique)
```
```
Entity: Project
  - id: String (cuid) — PRIMARY KEY
  - userId: String, NOT NULL
  - title: String, NOT NULL
  - idea: String, NOT NULL
  - status: String, NOT NULL, default: "DRAFT" (valid: DRAFT | GENERATING | DONE | FAILED)
  - createdAt: DateTime, NOT NULL, default: now()
  - updatedAt: DateTime, NOT NULL, auto-update
  Foreign keys: userId → User.id ON DELETE CASCADE
  Indexes: userId
```
```
Entity: Prd
  - id: String (cuid) — PRIMARY KEY
  - projectId: String, NOT NULL
  - modelUsed: String, NOT NULL
  - content: Json, NOT NULL (structured: title, overview, features[] dengan phase/status/subFeatures)
  - tokensUsed: Int, nullable
  - createdAt: DateTime, NOT NULL, default: now()
  Foreign keys: projectId → Project.id ON DELETE CASCADE
  Indexes: projectId
```
```
Entity: CliToken
  - id: String (cuid) — PRIMARY KEY
  - userId: String, NOT NULL
  - tokenHash: String, NOT NULL, unique
  - createdAt: DateTime, NOT NULL, default: now()
  - lastUsedAt: DateTime, nullable
  - revokedAt: DateTime, nullable
  Foreign keys: userId → User.id ON DELETE CASCADE
  Indexes: tokenHash (unique)
```
- **Key relationships:** User 1:N Project, Project 1:N Prd, User 1:N Account, User 1:N Session, User 1:N CliToken

### Domain Rules & Behavior
- Kuota generate bulanan per plan: FREE 3, STARTER 30, PRO 200 — reset di awal bulan kalender
- Data retention: akun tidak aktif (tidak login) 3 bulan berturut-turut sejak `User.lastActiveAt` → data dihapus otomatis (hard-delete cascade); email peringatan dikirim 30 hari sebelum penghapusan; user aktif tidak terpengaruh
- Input validation: `title` 3–120 char, `idea` 20–4000 char, `modelId` harus ada di whitelist `SUPPORTED_MODELS` — divalidasi zod di API boundary
- Workflow states: `Project.status` — DRAFT → GENERATING → DONE | FAILED. `Prd` immutable setelah dibuat (tidak ada state sendiri)
- Sensitive fields (perlu encryption at rest — belum diimplementasi, D1 tidak encrypt field-level default): `Account.refresh_token`, `Account.access_token`, `Account.id_token`, `CliToken.tokenHash`
- Delete strategy: hard-delete via `onDelete: Cascade` di semua relasi ke `User`
- Tables dengan live production traffic saat migrasi: User, Project, Prd, CliToken
- Multi-table atomic transactions: **tidak dipakai secara sengaja** — D1 tidak dukung transaction asli; `/api/generate` didesain sequential (create project → generate → create Prd → update status → update quota), toleran partial-failure

## 8. Environment & Configuration
- **Required env vars:** `DATABASE_URL` (placeholder, tidak dipakai runtime — D1 adalah binding bukan connection string), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `OPENROUTER_API_KEY`, `NEXT_PUBLIC_APP_URL`, plus Task #004 additions: `SENTRY_DSN` (optional, non-secret — unset/empty ⇒ Sentry disabled; set in wrangler `vars` or dashboard), `SENTRY_ENVIRONMENT` (optional, default NODE_ENV), `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` (CI-only, sourcemap uploads — token is a real secret, never commit)
- **Feature flags:** none
- **Observability:** log bawaan Cloudflare Workers (`observability.enabled` di wrangler config); error tracking **Sentry — diimplementasi Task #004** (`@sentry/nextjs`, beforeSend PII/secret scrubbing wajib per UU PDP, no-DSN no-op); metrics dan alerting channel spesifik belum diputuskan
- **Build/deploy:** `npm run cf:deploy` (`opennextjs-cloudflare build` + `deploy`)
- **Multi-environment:** dev / production (belum ada staging eksplisit)
- **Backup:** D1 Time Travel — bawaan, otomatis, gratis; restore ke menit manapun dalam 30 hari terakhir
- **RTO/RPO:** RPO granularity per-menit dalam 30 hari; RTO cepat via command restore Wrangler, belum ditest manual
- **Canary/staged-rollout:** tidak berlaku — target 100 pengunjung/bulan, jauh di bawah threshold 1.000
- **Code graph tool:** none (default — belum ada keputusan eksplisit dari developer)

## 9. Constraints & Anti-patterns
- No raw SQL string concatenation — selalu lewat Prisma query builder
- No `any` type di TypeScript
- No `console.log` di production
- No secrets di source code — wrangler secrets / `.env` saja
- No unverified inbound webhook payload — berlaku untuk webhook Xendit begitu diimplementasi
- No replikasi verbatim UI copy, desain visual, atau teks prompt dari ngodingpakeai.com
- Secret-comparison policy: perbandingan token/secret pakai constant-time comparison, bukan `===`/`==`
- Regex policy: hindari pola regex dengan nested quantifier rawan catastrophic backtracking pada input dari user
- API stability policy: additive-only dalam satu versi (karena ada CLI sebagai external consumer)
- Migration locking policy: tidak applicable dalam bentuk konvensional (mis. Postgres table lock) — D1 punya model transaction berbeda (lihat batasan "tanpa native transaction" di §7); belum ada migrasi live-traffic yang pernah dijalankan untuk dijadikan acuan
- Container secret policy: N/A — bukan container-based
- **Performance constraint:** Cloudflare Workers Free — 10ms CPU time/request; SSR+auth+query berat bisa mepet; upgrade Workers Paid ($5/bulan) kalau kena, naik ke 30 detik CPU default
- **Known technical limitations:** OpenRouter `:free` 50 request/hari (1.000/hari kalau pernah top-up $10 sekali); D1 tanpa native transaction; D1 5GB + 5M read/write/bulan; Resend Free 100 email/hari, 3.000/bulan; Workers Free 100K request/hari
- **Compliance:** UU PDP (Indonesia) berlaku — breach notification wajib 3×24 jam ke pemilik data & lembaga pengawas; data retention 3 bulan untuk akun tidak aktif (lihat §7). Lokalisasi data (PP 71/2019) vs hosting Cloudflare — hosting dikonfirmasi tetap Cloudflare, konsultasi hukum ditangani Banu di luar proyek ini

### Sensitive / High-Blast-Radius Code
(belum ada — diisi seiring development ditemukan, bukan saat extraction awal)
