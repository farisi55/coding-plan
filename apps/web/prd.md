---
doc_id: PRD-CODING-PLAN-001
version: 1.3.1
status: draft
created: 2026-09-16
flow_compatibility: vibe-coding-v1.7
project_shape: fullstack
---

# coding-plan — Product Requirements Document

## 1. Executive Summary
- **Project Shape:** fullstack
- **Problem:** Developer solo, tim kecil, dan technical founder MSME sering mulai coding pakai AI coding agent tanpa spec/plan yang jelas, sehingga hasilnya sering meleset dari scope atau butuh banyak rework.
- **Solution:** Web app yang mengubah ide produk (baru maupun codebase eksisting) jadi PRD terstruktur Fase → Fitur → Sub-fitur yang siap dieksekusi AI coding agent, didukung CLI companion untuk sinkronisasi codebase eksisting.
- **Success metric:** `[DECISION NEEDED]` — belum ada satu KPI terpilih dari developer. Kandidat: (a) jumlah user aktif dalam 6 bulan pertama (lihat §6.1), atau (b) persentase PRD hasil generate yang dipakai user tanpa regenerate ulang (proxy kualitas output).
- **MVP deadline:** not specified

## 2. Users & Context
- **Primary users:** Solo developer, tim kecil, atau technical founder MSME yang pakai AI coding agent (Claude Code, Cursor, Codex, dll) dan butuh planning/spec sebelum mulai ngoding.
- **User goal:** Dari ide mentah atau codebase yang sudah berjalan, dapatkan PRD terstruktur yang siap langsung dieksekusi AI coding agent.
- **Current pain:** Planning manual sebelum coding makan waktu atau di-skip sepenuhnya, sehingga AI coding agent kerja tanpa arah jelas dan hasilnya sering butuh banyak rework.
- **Environment:** Aplikasi web (browser) untuk flow utama; CLI (terminal, dijalankan lewat `npx`) sebagai companion untuk sync codebase eksisting.
- **External API consumers:** Ya — CLI companion tool (proyek terpisah, lihat `developer-brief-cli-tool.md`) mengonsumsi endpoint auth/bootstrap dan endpoint ingest-summary di backend ini.

## 3. Scope

### 3.1 In-Scope Features
| Feature | Priority | Description |
|---|---|---|
| Idea-to-PRD generator | P0 — MVP | Input ide, wizard klarifikasi opsional, pilih model AI, hasil PRD terstruktur Fase/Fitur/Sub-fitur. **Status: sudah diimplementasi** (tanpa wizard klarifikasi — belum diprioritaskan) |
| Existing-project flow | P0 | Bootstrap layar + sync codebase via CLI, status fitur direkonsiliasi dari bukti kode nyata, chat Workspace Agent (RAG), 3 opsi delivery (PRD.md/ZIP/prompt agent). **Status: belum diimplementasi** |
| Project & PRD dashboard | P1 | Riwayat project, buka/generate ulang PRD, status per fitur. **Status: belum diimplementasi** |
| Multi-model AI selection | P0 — MVP | Pilih model AI via OpenRouter gateway. **Status: sudah diimplementasi** (saat ini scoped ke model `:free`) |
| Autentikasi | P0 — MVP | Google OAuth + email magic link, sesi database-backed. **Status: sudah diimplementasi** |
| Subscription & billing | P1 | Plan Free/Starter/Pro, enforcement kuota bulanan. **Status: schema kuota ada, payment gateway belum diimplementasi — sengaja ditunda dari sprint MVP** |
| Community & consultation | P2 | Link komunitas (Discord) + form kontak konsultasi. **Status: belum diimplementasi** |

### 3.2 Out of Scope (explicit)
- Visualisasi node-graph/mind-map interaktif (pan/zoom) — v1 pakai list per-fase yang bisa di-expand
- White-labeling / fitur multi-tenant enterprise
- Native mobile app
- Real-time collaborative editing PRD (multi-user simultan)

### 3.3 Future Considerations
- Visualisasi node-graph interaktif (upgrade dari list-view kalau ada demand)
- White-labeling untuk potensi tier agency/enterprise
- Native mobile app companion

## 4. Technical Specification

### 4.1 Tech Stack
- **Language & Runtime:** TypeScript 5.x / Node.js (via Cloudflare Workers `nodejs_compat`)
- **Framework:** Next.js 15.5.25, App Router (versi presisi dikonfirmasi saat setup Cloudflare — `@opennextjs/cloudflare@1.x` butuh minimal 15.5.24)
- **Database:** Cloudflare D1 (SQLite) via Prisma `@prisma/adapter-d1`
- **ORM / Query builder:** Prisma 5.x (`previewFeatures = ["driverAdapters"]`)
- **Cache:** none `[ASSUMED — belum dibutuhkan di skala MVP]`
- **Infrastructure:** Cloudflare Workers, via adapter `@opennextjs/cloudflare`
- **Container orchestration:** none (serverless, bukan container-based)
- **Key third-party services:** OpenRouter (AI gateway, model `:free` untuk MVP), Cloudflare Vectorize + Workers AI (RAG Workspace Agent — belum diimplementasi), Resend (email HTTP API), **Xendit** (payment gateway, dikonfirmasi)
- **Webhook providers:** payment gateway webhook (konfirmasi pembayaran) — aktif begitu payment gateway diimplementasi
- **Frontend framework:** React 19 (bundled Next.js 15) + Tailwind CSS

### 4.2 Architecture
- **Pattern:** Serverless (Cloudflare Workers) + Next.js App Router — route handlers sebagai API layer, server components untuk SSR
- **Module structure:**
  ```
  coding-plan/                    # npm workspaces monorepo root
  ├── developer-brief-web-app.md, developer-brief-cli-tool.md
  ├── apps/web/                    # this PRD's unit — everything below is inside it
  │   ├── prisma/schema.prisma
  │   ├── src/
  │   │   ├── app/
  │   │   │   ├── api/
  │   │   │   │   ├── auth/[...nextauth]/route.ts
  │   │   │   │   └── generate/route.ts
  │   │   │   ├── layout.tsx
  │   │   │   ├── page.tsx
  │   │   │   └── globals.css
  │   │   ├── components/
  │   │   │   └── PrdGenerator.tsx
  │   │   └── lib/
  │   │       ├── auth.ts       # getAuthOptions() — dibangun per-request
  │   │       ├── db.ts         # getDb() — Prisma client per-request, D1-bound
  │   │       └── openrouter.ts # generatePrd(), SUPPORTED_MODELS
  │   ├── cloudflare-env.d.ts    # bridges wrangler's generated Env ke CloudflareEnv
  │   ├── wrangler.jsonc, open-next.config.ts, next.config.mjs, package.json
  │   └── prd.md, knowledge.md, changelog.md   # dokumen ini
  └── packages/
      ├── shared/src/index.ts    # ApiError/ApiResponse/PrdContent/Feature/SubFeature
      └── cli/                   # belum diimplementasi
  ```
  `.gitignore`/`.husky/` ada di root monorepo (git hook berlaku semua workspace), bukan di dalam `apps/web/`.
- **Key design patterns:** Zod validation di API boundary; per-request resource factory (`getDb()`, `getAuthOptions()`) menggantikan pola singleton Node tradisional
- **Data flow:** client → Next.js Route Handler → validasi zod → Prisma (D1) / OpenRouter → response JSON
- **Key architectural decisions:**
  1. Cloudflare Workers + D1 dipilih di atas Vercel + Postgres — mencapai target hosting $0/bulan; trade-off: D1 tidak dukung transaction asli, kode didesain tanpa bergantung pada atomicity multi-tabel.
  2. Prisma client per-request (`getDb()`) dipilih di atas singleton module-level — Workers tidak punya `process.env`/state persisten antar-request seperti Node server tradisional; binding D1 cuma tersedia dalam konteks request.
  3. Model AI `:free` dipilih di atas model premium untuk MVP — mencapai target biaya inference $0; trade-off: kualitas output lebih rendah, rate limit 50 request/hari.
  4. Output PRD terstruktur (JSON Fase→Fitur→Sub-fitur) dipilih di atas markdown freeform — lebih actionable buat AI coding agent dan bisa di-render granular per section; berubah dari keputusan awal setelah riset kompetitor.
  5. Resend (HTTP API) dipilih di atas SMTP untuk email transaksional — Cloudflare Workers memblokir outbound SMTP port 25/587 secara default.
  6. Monorepo (npm workspaces: `apps/web` + `packages/shared` + `packages/cli`) dipilih di atas 2 repo terpisah — shared TypeScript contract (response envelope, struktur PRD) dengan CLI di masa depan mengalahkan overhead 2-repo buat solo developer; `prd.md`/`knowledge.md`/`changelog.md` tetap terpisah per unit (Appendix I tetap berlaku di level dokumen, cuma repo/tooling-nya yang digabung). Trade-off yang diterima: risiko drift antar unit gantinya jadi risiko duplikasi kode dalam satu repo — sudah kejadian sekali (`PrdGenerator.tsx` sempat punya salinan type sendiri, lepas dari `openrouter.ts`) dan langsung ketahuan begitu `packages/shared` dibuat.

### 4.3 Code Standards
- **Naming — files:** kebab-case, mengikuti konvensi Next.js App Router (`route.ts`, `page.tsx`)
- **Naming — functions:** camelCase (`generatePrd`, `getDb`, `slugify`)
- **Naming — classes/types:** PascalCase (`PrdContent`, `SupportedModel`)
- **Formatter:** Prettier (dikonfirmasi)
- **Linter:** ESLint + `@typescript-eslint` + `eslint-config-next` (dikonfirmasi)
- **Testing framework:** Vitest (dikonfirmasi)
- **Test coverage target:** >80% (dikonfirmasi) — lines/functions/branches/statements
- **Error handling:** try-catch di boundary route handler; error dikembalikan sebagai `{ error: string }` JSON dengan HTTP status code sesuai (pola yang sudah dipakai di `/api/generate`)

### 4.4 API Design
- **API type:** REST (Next.js Route Handlers)
- **Base URL pattern:** `/api/` — belum ada versioning path eksplisit (`/v1/`)
- **Authentication method:** Session database-backed (NextAuth) untuk web. Untuk CLI: **OAuth browser-based dengan callback URL copy-paste** (dikonfirmasi) — CLI cetak URL otorisasi (`/cli-auth/start`), user login di browser (reuse Google OAuth/email magic-link yang sudah ada), setelah otorisasi backend menampilkan URL callback berisi token sekali-tukar yang di-copy-paste user balik ke terminal. Pola ini dipilih karena CLI tidak selalu bisa jalankan local HTTP listener (mis. environment remote/SSH/container). Butuh entity baru `CliToken` — lihat §4.5.
- **Response envelope:** `{ data: T | null, error: { code: string, message: string, details?: unknown } | null }` — standardize sekarang (dikonfirmasi), berlaku untuk seluruh route baru; route existing (`/api/generate`) perlu disesuaikan mengikuti bentuk ini.
- **Error format:** Mengikuti response envelope di atas — `error.code` (string mesin-baca, mis. `"QUOTA_EXCEEDED"`), `error.message` (human-readable), `error.details` opsional. `request_id` `[DECISION NEEDED — belum diputuskan apakah perlu di tahap ini]`
- **Pagination:** none — belum ada endpoint list (dashboard belum dibangun)
- **API versioning strategy:** none saat ini. `[DECISION NEEDED — penting karena §2 sudah declare ada external consumer (CLI)]`
- **Backward compatibility policy:** ASSUMED additive-only (karena §2 declare ada external API consumer, sesuai aturan template ini)
- **Rate limiting store:** none di level aplikasi — saat ini mengandalkan rate limit bawaan OpenRouter free tier (50/hari) sebagai satu-satunya pembatas. `[DECISION NEEDED kalau butuh rate limit per-user di level API sendiri]`
- **Webhook inbound verification:** `[DECISION NEEDED — belum relevan sampai payment gateway diimplementasi]`

### 4.5 Data Model

```
Entity: User
  - id: String (cuid) — PRIMARY KEY
  - name: String, nullable
  - email: String, NOT NULL, unique
  - emailVerified: DateTime, nullable
  - image: String, nullable
  - plan: String, NOT NULL, default: "FREE" (valid: FREE | STARTER | PRO — divalidasi zod, D1 tanpa native enum)
  - generationsThisMonth: Int, NOT NULL, default: 0
  - quotaResetAt: DateTime, NOT NULL, default: now()
  - lastActiveAt: DateTime, NOT NULL, default: now()  [BARU — dipakai job retention 3 bulan di §4.5]
  - createdAt: DateTime, NOT NULL, default: now()
  Foreign keys: none
  Indexes: email (unique) — dicek tiap login/session lookup
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
  Indexes: (provider, providerAccountId) unique — dicek tiap OAuth callback
```

```
Entity: Session
  - id: String (cuid) — PRIMARY KEY
  - sessionToken: String, NOT NULL, unique
  - userId: String, NOT NULL
  - expires: DateTime, NOT NULL
  Foreign keys: userId → User.id ON DELETE CASCADE
  Indexes: sessionToken (unique) — dicek tiap request untuk validasi sesi
```

```
Entity: VerificationToken
  - identifier: String, NOT NULL
  - token: String, NOT NULL, unique
  - expires: DateTime, NOT NULL
  Foreign keys: none
  Indexes: (identifier, token) unique, token (unique) — dicek tiap klik magic link
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
  Indexes: userId — dicek tiap load dashboard riwayat project
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
  Indexes: projectId — dicek tiap load PRD milik satu project
```

```
Entity: CliToken  [BARU — akibat keputusan auth CLI di §4.4]
  - id: String (cuid) — PRIMARY KEY
  - userId: String, NOT NULL
  - tokenHash: String, NOT NULL, unique (token asli tidak pernah disimpan plaintext)
  - createdAt: DateTime, NOT NULL, default: now()
  - lastUsedAt: DateTime, nullable
  - revokedAt: DateTime, nullable
  Foreign keys: userId → User.id ON DELETE CASCADE
  Indexes: tokenHash (unique) — divalidasi tiap request dari CLI
```

- **Key relationships (summary):** User 1:N Project, Project 1:N Prd, User 1:N Account, User 1:N Session, User 1:N CliToken
- **Storage strategy:** relational (SQLite via D1)
- **Sensitive fields:** `Account.refresh_token`, `Account.access_token`, `Account.id_token`, `CliToken.tokenHash` — token OAuth/akses, idealnya di-encrypt at rest. `[DECISION NEEDED — D1 tidak encrypt field-level secara default, butuh app-level encryption kalau mau strict]`
- **Delete strategy:** **Hard-delete via `onDelete: Cascade`** (dikonfirmasi — tetap seperti implementasi saat ini, tidak pindah ke soft-delete)
- **Data retention:** **3 bulan (dikonfirmasi).** Interpretasi konkret yang dipakai (perlu dikonfirmasi kalau meleset dari maksud aslinya): berlaku untuk akun yang **tidak aktif** (tidak login) selama 3 bulan berturut-turut sejak `User.lastActiveAt` — data akun (Project, Prd, dst) dihapus otomatis mengikuti hard-delete cascade di atas. User aktif (login dalam 3 bulan terakhir) **tidak terpengaruh** — data mereka tidak dihapus selagi masih pakai layanan. **Email peringatan dikirim 30 hari sebelum penghapusan (dikonfirmasi)** — berarti job perlu cek akun yang sudah 2 bulan tidak aktif (bulan ke-3 minus 30 hari) buat trigger email itu. Butuh field baru `User.lastActiveAt` (lihat §4.5 entity) dan scheduled job (Cloudflare Cron Trigger) untuk eksekusi — **belum diimplementasi**, didokumentasikan sebagai requirement.
- **Tables expected to carry live production traffic during migrations:** User, Project, Prd, CliToken
- **Schema size:** 7 entity — di bawah threshold ~15, tetap inline di knowledge.md, tidak perlu file schema.md terpisah

### 4.6 Brand & Visual Identity
- **Color palette:** `ink` #12181F (background), `paper` #F6F4EF (teks/panel), `signal` #E8B34B (CTA/highlight, dipakai sparingly), `line` #2A323C (border), `muted` #8A94A3 (teks sekunder) — sudah konkret di `tailwind.config.ts`
- **Typography:** Fraunces (serif, display/heading), Inter (sans, body), JetBrains Mono (kode/mono) — sudah konkret di `globals.css`
- **Brand voice / tone:** `[DECISION NEEDED — belum didefinisikan eksplisit; copy UI yang ada sejauh ini netral-profesional]`
- **Visual direction:** Dark-mode-first, minimal, aesthetic developer-tool (konsisten dengan palette yang sudah dipilih)
- **Existing brand guide:** none. **"coding-plan" dikonfirmasi dipakai sebagai nama produk untuk fase MVP/gratis saat ini** — nama brand konsumen yang lebih formal akan dipertimbangkan ulang khusus saat fitur berbayar (Feature 6, §5) live, bukan sekarang

## 5. Feature Specifications

### Feature: Idea-to-PRD Generator
- **User story:** Sebagai solo developer/technical founder MSME, saya ingin menuliskan ide produk saya dan mendapat PRD terstruktur (Fase/Fitur/Sub-fitur), supaya saya punya spec jelas untuk AI coding agent tanpa menulis planning manual dari nol.
- **Acceptance criteria:**
  - [ ] User bisa input judul + deskripsi ide (min 20 karakter) dan memilih model AI dari dropdown
  - [ ] Sistem menghasilkan PRD terstruktur (title, overview, features dengan phase 1–4, sub-features dengan deskripsi)
  - [ ] Hasil PRD tersimpan ke database, terhubung ke project & user yang generate
  - [ ] Kalau AI gagal menghasilkan JSON valid, user mendapat pesan error yang jelas, bukan silent fail
- **Business rules:** Kuota generate bulanan sesuai plan (FREE: 3, STARTER: 30, PRO: 200); kuota reset di awal bulan kalender
- **UI notes:** Form dua kolom (input kiri, hasil kanan); hasil dirender sebagai list per-fase yang bisa di-expand
- **Priority:** P0 — **sudah diimplementasi**

### Feature: Existing-Project Flow
- **User story:** Sebagai developer yang sudah punya codebase jalan, saya ingin sync codebase saya supaya AI coding agent paham konteks proyek nyata sebelum membuat PRD fitur baru, dan saya bisa melihat fitur mana yang sudah selesai vs yang masih direncanakan.
- **Acceptance criteria:**
  - [ ] User bisa generate token sekali-pakai + instruksi CLI dari web app
  - [ ] Setelah CLI sync selesai, status fitur di web app mencerminkan kondisi kode nyata (bukan default "planned" untuk semua)
  - [ ] User bisa chat tanya-jawab (Workspace Agent) soal codebase-nya, jawaban grounded di ringkasan yang sudah di-sync
  - [ ] User bisa memilih 1 dari 3 cara lanjut: download PRD.md, download ZIP (PRD + spec + task), atau dapat prompt untuk AI agent eksekusi otomatis
- **Business rules:** Raw source code TIDAK PERNAH diupload dari CLI — hanya metadata file + ringkasan yang ditulis AI agent secara lokal
- **UI notes:** List/tree view hasil sync (bukan node-graph pan/zoom — lihat §3.2), chat panel di sisi kanan
- **Priority:** P0 — **belum diimplementasi** (fitur terbesar yang belum dibangun sama sekali)

### Feature: Project & PRD Dashboard
- **User story:** Sebagai user yang sudah pernah generate PRD, saya ingin melihat riwayat semua project saya, supaya saya bisa membuka ulang atau generate ulang tanpa menulis ide dari awal lagi.
- **Acceptance criteria:**
  - [ ] User bisa melihat list semua project miliknya, urut dari terbaru
  - [ ] User bisa klik satu project untuk melihat PRD lengkap yang pernah digenerate
  - [ ] User bisa melihat status tiap fitur di project (planned/in progress/done)
- **Business rules:** User hanya bisa melihat project miliknya sendiri (scoped by `userId`)
- **UI notes:** Table/list sederhana, klik row untuk buka detail
- **Priority:** P1 — **belum diimplementasi**

### Feature: Multi-Model AI Selection
- **User story:** Sebagai user, saya ingin memilih model AI mana yang generate PRD saya, supaya saya bisa menyesuaikan trade-off kualitas vs kecepatan/biaya.
- **Acceptance criteria:**
  - [ ] Dropdown model AI muncul di form generate, minimal satu opsi tersedia
  - [ ] Model yang dipilih tervalidasi terhadap whitelist `SUPPORTED_MODELS` sebelum request ke OpenRouter dikirim
  - [ ] Nama model yang dipakai tersimpan di record PRD (`modelUsed`) untuk audit/debugging
- **Business rules:** MVP awal hanya mengekspos model `:free` (lihat §4.1); model premium jadi opsi plan berbayar ke depan
- **UI notes:** Dropdown sederhana, label human-readable (bukan raw model slug)
- **Priority:** P0 — **sudah diimplementasi**

### Feature: Autentikasi
- **User story:** Sebagai user baru, saya ingin login pakai Google atau email, supaya saya bisa mulai generate PRD tanpa membuat password baru.
- **Acceptance criteria:**
  - [ ] User bisa login via Google OAuth
  - [ ] User bisa login via email magic link (dikirim lewat Resend)
  - [ ] Sesi tersimpan di database (D1), bukan hanya JWT stateless
  - [ ] User yang belum login diarahkan ke landing/login page, bukan bisa akses generator langsung
- **Business rules:** Satu email = satu akun (unique constraint di schema)
- **UI notes:** Tombol "Masuk untuk mulai" di landing page
- **Priority:** P0 — **sudah diimplementasi**

### Feature: Subscription & Billing
- **User story:** Sebagai user yang kuota FREE-nya sudah habis, saya ingin upgrade ke plan berbayar, supaya saya bisa terus generate PRD tanpa menunggu reset bulanan.
- **Acceptance criteria:**
  - [ ] User bisa melihat plan saat ini & sisa kuota
  - [ ] User bisa upgrade ke Starter/Pro lewat payment gateway
  - [ ] Setelah pembayaran sukses (webhook diterima & tervalidasi), plan user ter-update otomatis
  - [ ] Kalau pembayaran gagal, user mendapat notifikasi jelas, kuota tidak ter-upgrade
- **Business rules:** Kuota per plan sesuai Feature 1 (FREE: 3, STARTER: 30, PRO: 200 per bulan)
- **UI notes:** Halaman pricing/upgrade sederhana, badge plan di header
- **Priority:** P1 — **belum diimplementasi** (sengaja ditunda dari sprint MVP; payment gateway juga `[DECISION NEEDED]`)

### Feature: Community & Consultation
- **User story:** Sebagai user, saya ingin akses komunitas developer lain yang pakai produk ini dan opsi konsultasi custom, supaya saya tidak stuck sendirian kalau butuh bantuan lebih lanjut.
- **Acceptance criteria:**
  - [ ] Ada link keluar ke komunitas (Discord) yang bisa diakses dari dalam app
  - [ ] Ada form kontak untuk request konsultasi custom, submission masuk ke email/channel yang dipantau
- **Business rules:** none khusus — fitur ini lightweight/marketing-adjacent, bukan core product logic
- **UI notes:** Link/CTA di footer atau dashboard, bukan halaman kompleks
- **Priority:** P2 — **belum diimplementasi**

## 6. Non-Functional Requirements

### 6.1 Performance & Scale
- Response time target: `[DECISION NEEDED — belum ada SLA eksplisit]`. Asumsi wajar: P95 < 2 detik untuk request non-AI (auth, dashboard); generate PRD sendiri bisa lebih lama (model `:free`, potensial 5–30 detik)
- Concurrent users / usage volume (initial): `[ASSUMED]` puluhan user (fase testing awal)
- Concurrent users / usage volume (6-month target): **100 pengunjung/bulan (dikonfirmasi developer)**. Angka ini sendiri di bawah ~100 sesuai ambang Simple Mode, **tapi §6.4 sekarang punya compliance requirement eksplisit (UU PDP, review diminta di awal)** — karena syarat Simple Mode butuh KEDUANYA (skala rendah DAN tidak ada compliance requirement), **Simple Mode kemungkinan TIDAK applies otomatis** meski skalanya kecil. Keputusan final ini idealnya dikonfirmasi ulang di Prompt 01.

### 6.2 Security
- Auth standard: NextAuth.js, session database-backed, Google OAuth + email magic link
- JWT algorithm: N/A untuk sesi web (pakai database session, bukan JWT). Untuk CLI: token opaque (bukan JWT) disimpan sebagai hash di `CliToken.tokenHash` (lihat §4.5), bukan self-encoding — memudahkan revoke sewaktu-waktu tanpa perlu key rotation JWT.
- Password hashing: N/A — tidak ada password (OAuth + magic link saja, sesuai keputusan awal)
- PII handling: `[DECISION NEEDED — belum ada kebijakan eksplisit soal PII di log/data retention]`
- Error tracking PII policy: `[DECISION NEEDED — Sentry direkomendasikan tapi PII scrubbing belum dikonfigurasi]`
- Session: database-backed, token diregenerasi tiap login baru (default NextAuth)
- Brute force protection: N/A langsung (tidak ada password login), tapi `[DECISION NEEDED]` untuk rate-limit percobaan abuse magic-link/OAuth callback
- Secret rotation strategy: `[DECISION NEEDED]`

### 6.3 Scalability
- Growth expectation: `[DECISION NEEDED — belum ada target eksplisit]`
- Scaling strategy: serverless auto-scale (bawaan Cloudflare Workers)
- Caching: none `[ASSUMED — belum dibutuhkan di skala MVP]`
- DB scaling: D1 (SQLite-based) — cukup untuk skala MSME early-stage; `[DECISION NEEDED: perlu dievaluasi ulang kalau usage tumbuh signifikan, D1 punya karakteristik scaling berbeda dari Postgres tradisional untuk write-heavy workload]`

### 6.4 Compliance
- Standards: `[ASSUMED]` none secara eksplisit saat ini. `[DECISION NEEDED: WCAG 2.1 AA kalau accessibility mau diseriusin]`
- Regulations: **UU PDP (UU No. 27/2022) — dikonfirmasi berlaku, review diminta di awal (bukan ditunda).** Ringkasan faktual untuk titik awal review (bukan nasihat hukum — lihat catatan di bawah):
  - **Status regulasi saat ini (per pertengahan 2026):** UU PDP berlaku penuh sejak 2024, tapi **Badan Pelindungan Data Pribadi (lembaga pengawas) belum resmi terbentuk**. Ini menempatkan pelaku usaha di ruang abu-abu: rezim sanksi sudah diatur di undang-undang, tapi mekanisme penegakan administratif belum punya otoritas eksekutor. Kewajiban substantif (termasuk breach notification di bawah) tetap berlaku terlepas dari status lembaga ini.
  - **Cakupan:** berlaku untuk siapa pun/korporasi yang memproses data pribadi terkait perbuatan hukum di Indonesia (Pasal 2) — `coding-plan` masuk cakupan ini karena memproses email, nama (dari Google OAuth), dan konten ide/project milik user Indonesia.
  - **Kewajiban breach notification (Pasal 46):** wajib memberi tahu pemilik data DAN lembaga pengawas secara tertulis paling lambat **3×24 jam** sejak kegagalan perlindungan data diketahui — memuat data apa yang bocor, kapan/bagaimana, dan penanganan yang sudah dilakukan. Ini menuntut kesiapan SEBELUM insiden (tahu persis data apa yang disimpan & di mana), bukan sesuatu yang bisa disusun dadakan.
  - **Sanksi:** administratif hingga 2% pendapatan tahunan (Pasal 47, meski belum ada lembaga yang bisa menjatuhkannya saat ini); pidana untuk perorangan bisa Rp4–6 miliar (Pasal 67-68), dikali 10 untuk korporasi (Pasal 70).
  - **Klasifikasi data:** UU PDP membagi data umum (nama, alamat, telepon) vs data spesifik (kesehatan, biometrik, keuangan, catatan kejahatan, data anak) — data spesifik butuh pengamanan lebih ketat. Data yang diproses `coding-plan` (email, nama, konten ide) masuk kategori data umum; **kecuali** kalau fitur existing-project (§5) nanti mengumpulkan ringkasan codebase yang mengandung data pihak ketiga (mis. skema tabel user aplikasi klien) — ini perlu ditinjau ulang saat fitur itu didesain lebih detail.
  - **PP No. 71/2019 (PSE):** mewajibkan Penyelenggara Sistem Elektronik menjamin kerahasiaan/integritas data. **Resolusi:** hosting tetap Cloudflare (dikonfirmasi) — konsultasi hukum soal implikasi lokalisasi data akan dilakukan Banu di luar proyek/dokumen ini, bukan blocking untuk lanjut development.
  - **Praktik dasar yang masuk akal untuk dimulai (terlepas dari ketidakpastian penegakan):** (1) privacy notice yang jelas soal data apa yang dikumpulkan & untuk apa, (2) mekanisme user request hapus data — sudah selaras dengan keputusan hard-delete di §4.5, (3) draft rencana respons insiden 3×24 jam, (4) data minimization — jangan simpan lebih dari yang dibutuhkan.
  - **Bukan nasihat hukum:** ringkasan di atas adalah informasi umum untuk titik awal, disusun dari sumber publik per pertengahan 2026, bukan pengganti konsultasi dengan praktisi hukum pelindungan data. Konsultasi lokalisasi data (poin PP 71/2019 di atas) **sudah dikonfirmasi akan dilakukan Banu terpisah di luar proyek ini** — dicatat di sini sebagai tracking, bukan lagi item yang menahan development.

### 6.5 Observability
- **Logging:** Log bawaan Cloudflare Workers (dashboard, `observability.enabled` di wrangler config)
- **Log levels:** `[DECISION NEEDED — belum didefinisikan level spesifik]`
- **Error tracking / crash reporting:** Sentry direkomendasikan (free tier) — `[DECISION NEEDED: belum diimplementasi di kode]`
- **Metrics:** `[DECISION NEEDED — belum ada Prometheus/Datadog; mengandalkan dashboard bawaan Cloudflare dulu]`
- **Alerting:** Notifikasi Slack/email untuk error kritis — channel spesifik `[DECISION NEEDED]`
- **Health endpoints:** `[DECISION NEEDED — belum ada /health endpoint di kode saat ini]`
  - Non-orchestrated: `GET /health` → `{ status, uptime, db, version }`

## 7. Environment & Configuration
- **Environments:** dev / production `[ASSUMED — belum ada staging eksplisit, wajar untuk skala solo-dev]`
- **Required env vars (nama saja):** `DATABASE_URL` (placeholder, tidak dipakai runtime — D1 adalah binding, bukan connection string), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `OPENROUTER_API_KEY`, `NEXT_PUBLIC_APP_URL`
- **Feature flags:** none saat ini
- **CI/CD:** `[DECISION NEEDED — belum di-setup; rekomendasi GitHub Actions → wrangler deploy]`
- **CI secret masking:** `[DECISION NEEDED — berlaku setelah CI/CD di-setup]`
- **Container secret handling:** N/A (bukan container-based; Workers pakai wrangler secrets)
- **Deployment / distribution command:** `npm run cf:deploy` (sudah ada di `package.json`)
- **Application versioning strategy:** `[DECISION NEEDED — semver direkomendasikan; package.json saat ini di 0.2.0]`
- **Version tag/build-number format:** `[DECISION NEEDED]`
- **Release trigger:** `[DECISION NEEDED — manual `npm run cf:deploy` saat ini, belum ada automated trigger]`
- **Backup strategy:** D1 Time Travel — bawaan, otomatis, gratis, tanpa setup manual
- **Backup retention:** 30 hari (default D1 Time Travel)
- **RTO / RPO:** RTO cepat via command restore Wrangler (belum ditest manual saat insiden nyata); RPO granularity per-menit dalam 30 hari terakhir
- **Rollback / update-channel strategy:** `[DECISION NEEDED — redeploy git tag sebelumnya, belum ada proses formal]`

## 8. Constraints & Anti-patterns

### Technical Constraints
- Harus jalan di Cloudflare Workers — tidak ada Node.js `fs`/`net` mentah kecuali via polyfill `nodejs_compat`
- Solo developer — hindari arsitektur yang butuh tim ops
- Next.js wajib v15/16 (bukan v14) — adapter Cloudflare sudah berhenti dukung v14
- D1 tidak dukung transaction asli — kode harus toleran partial-failure, jangan asumsikan atomicity multi-tabel

### Forbidden Patterns
- No raw SQL string concatenation — selalu lewat Prisma query builder
- No `any` type di TypeScript
- No `console.log` di production — `[DECISION NEEDED: structured logger belum dipilih]`
- No hard-delete tanpa review lebih lanjut — lihat §4.5 soal delete strategy yang masih open
- No secrets di source code — wrangler secrets / `.env` saja, jangan pernah commit
- No unverified inbound webhook payload — berlaku begitu payment gateway diimplementasi
- Tidak boleh replikasi verbatim UI copy, desain visual, atau teks prompt dari ngodingpakeai.com

### Known Third-Party Limitations
- OpenRouter `:free` models: 50 request/hari per akun (naik ke 1.000/hari kalau pernah top-up $10 sekali, permanen)
- Cloudflare Workers Free: 10ms CPU time per request — SSR + auth + query berat bisa mepet di halaman tertentu
- Cloudflare D1: tidak ada native transaction support
- Resend Free: 100 email/hari, 3.000/bulan

### Security Hard Rules
- No secrets di source code — wrangler secrets / `.env` saja
- CORS jangan wildcard `*` di production — `[DECISION NEEDED: kebijakan CORS spesifik belum didefinisikan, relevan karena CLI adalah external API consumer]`

## 9. Development Phases

| Phase | Name | Applies? | Catatan |
|---|---|---|---|
| Phase 1 | Foundation | ✓ Always | |
| Phase 2 | Domain & Data | ✓ | Database bukan "none" (D1) |
| Phase 3 | Core Features | ✓ Always | |
| Phase 4 | Integration | ✓ | OpenRouter, Resend, (nanti) payment gateway |
| Phase 5 | UI/UX | ✓ | Shape fullstack punya UI |
| Phase 6 | Testing & QA | ✓ Always | Testing framework masih `[DECISION NEEDED]`, lihat §4.3 |
| Phase 7 | Deployment | ✓ Always | Varian: Cloudflare Workers via `wrangler`/`opennextjs-cloudflare` |

6-month target row (canary/staged rollout kalau > 1.000): **tidak berlaku** — target dikonfirmasi 100 pengunjung/bulan (§6.1), jauh di bawah threshold.

## 10. Open Questions

| # | Question | Jawaban | Status |
|---|---|---|---|
| 1 | Berapa angka riil target user/usage 6 bulan pertama? | 100 pengunjung/bulan | ✅ RESOLVED |
| 2 | Payment gateway mana yang dipakai? | Xendit | ✅ RESOLVED |
| 3 | "coding-plan" itu nama brand konsumen final atau cuma internal project slug? | Internal slug saja | ✅ RESOLVED — nama brand final masih `[DECISION NEEDED]` terpisah |
| 4 | Skema auth untuk CLI (token-based) — format & lifecycle token seperti apa? | OAuth browser-based, callback URL di-copy-paste ke terminal | ✅ RESOLVED |
| 5 | Formatter/linter/testing framework mana yang dipakai? | Prettier + ESLint + Vitest | ✅ RESOLVED |
| 6 | Apakah UU PDP Indonesia berlaku dan perlu compliance eksplisit? | Ya, review diminta di awal | ✅ RESOLVED — lihat §6.4 untuk starting point |
| 7 | Delete strategy Project/Prd — hard-delete cascade (saat ini) atau soft-delete? | Hard-delete (tetap seperti implementasi saat ini) | ✅ RESOLVED |
| 8 | Response envelope & error format API — standardize sekarang atau nanti? | Standardize sekarang | ✅ RESOLVED — lihat §4.4 |

**Item baru yang muncul dari jawaban di atas** (bukan lagi soal §10 lama, tapi belum ada jawabannya):
| # | Question | Jawaban | Status |
|---|---|---|---|
| 9 | Nama brand konsumen final (karena "coding-plan" dikonfirmasi cuma internal slug) | "coding-plan" dipakai untuk fase MVP/gratis; brand formal dipertimbangkan ulang saat fitur berbayar live | ✅ RESOLVED |
| 10 | Test coverage target spesifik (Vitest sudah dipilih di §4.3, angkanya belum) | >80% | ✅ RESOLVED |
| 11 | Data retention period spesifik (§4.5) — terutama relevan sekarang karena UU PDP dikonfirmasi berlaku | 3 bulan (untuk akun tidak aktif) | ✅ RESOLVED — lihat §4.5 untuk interpretasi konkret |
| 12 | Titik lokalisasi data PP 71/2019 vs hosting Cloudflare global (§6.4) | Hosting tetap Cloudflare; konsultasi hukum dilakukan Banu di luar proyek ini | ✅ RESOLVED |

**Item turunan baru** (kecil, tidak blocking):
| # | Question | Jawaban | Status |
|---|---|---|---|
| 13 | Berapa hari sebelum penghapusan akun tidak-aktif, email peringatan dikirim? | 30 hari | ✅ RESOLVED |

**Item baru dari sesi restrukturisasi monorepo:**
| # | Question | Jawaban | Status |
|---|---|---|---|
| 14 | Prisma sekarang di major version 8, kita masih pin `^5.20.0` — upgrade sekarang atau nanti? | **Upgrade sekarang — tapi ke 7.10.0, bukan 8.x.** 8.x ternyata masih release candidate (`8.0.0-rc.15`), dan `@prisma/adapter-d1` belum di-publish untuk 8.x sama sekali — cuma ada sampai 7.10.0. Upgrade sekalian ke generator baru (`provider = "prisma-client"`, `output` custom, `engineType = "client"` — no Rust binary, cocok buat Workers). **Belum terverifikasi end-to-end** — `prisma generate` nggak bisa selesai di sandbox saya (network allowlist), perlu dikonfirmasi di mesin kamu | ✅ RESOLVED (dengan catatan verifikasi) |

## 11. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-09-16 | Claude (Sonnet 5), atas permintaan Banu | Initial draft — digenerate dari developer's brief hasil sesi planning; grounded di kode MVP yang sudah berjalan untuk bagian yang sudah diimplementasi |
| 1.1.0 | 2026-09-16 | Claude (Sonnet 5), atas permintaan Banu | Resolve 8 Open Questions (scale, payment gateway, brand slug, CLI auth, tooling, UU PDP, delete strategy, response envelope); tambah entity `CliToken`; 4 pertanyaan baru muncul (§10 #9-12) |
| 1.2.0 | 2026-09-17 | Claude (Sonnet 5), atas permintaan Banu | Resolve #9-12 (nama produk MVP, test coverage 80%, retensi data 3 bulan + `User.lastActiveAt`, lokalisasi data di-defer ke konsultasi eksternal); 1 pertanyaan kecil baru muncul (#13) |
| 1.2.1 | 2026-09-18 | Claude (Sonnet 5), atas permintaan Banu | Resolve #13 (email peringatan 30 hari sebelum hapus akun tidak aktif) — 13/13 open question sudah resolved |
| 1.3.0 | 2026-09-20 | Claude (Sonnet 5), atas permintaan Banu | Sync dengan restrukturisasi monorepo (npm workspaces): module structure diperbarui, tambah Key Architectural Decision #6 (monorepo vs repo terpisah), versi Next.js dipresisikan (15.5.25), 1 pertanyaan baru (#14, upgrade Prisma 5→8) |
| 1.3.1 | 2026-09-23 | Claude (Sonnet 5), atas permintaan Banu | Resolve #14 — upgrade Prisma ke 7.10.0 (bukan 8.x, masih RC), generator baru (`prisma-client` + `engineType: "client"`); tambah Key Architectural Decision #7. Belum terverifikasi end-to-end — lihat knowledge.md §2 |

---

# PRD Self-Check

- [x] Project Shape stated unambiguously in §1 (fullstack)
- [x] §4.1 Database explicitly named (Cloudflare D1) — Phase 2 included
- [x] §4.1 third-party services explicitly listed — Phase 4 included
- [x] §4.2 Architecture: 5 Key Architectural Decisions stated, masing-masing dengan alternatif nyata + alasan satu-kalimat
- [x] §4.4 API Design present (shape fullstack punya API surface)
- [x] §4.5 Data Model present (database bukan "none")
- [x] §4.5 Entity Schema: semua 6 entity punya detail level-kolom (type, nullable, default, constraint)
- [x] §5 Features: setiap fitur P0 punya ≥2 acceptance criteria + ≥1 business rule
- [x] §6.1 Scale: estimasi 6 bulan dinyatakan (meski sebagai `[ASSUMED]`, belum dikonfirmasi)
- [x] §6.4 Compliance: dinyatakan sebagai `[ASSUMED] none` + `[DECISION NEEDED]` untuk UU PDP — bukan dibiarkan kosong
- [x] §9 Phases: kolom "Applies?" konsisten dengan jawaban §4.1/§4.5

Knowledge extraction readiness:
- [x] §1 Identity + Project Shape, §2 Users, §3 Scope, §4 Technical Specification, §5 Feature Specifications — lengkap
- [x] §6 Non-Functional Requirements, §7 Environment, §8 Constraints — lengkap
- [x] §9 Development Phases matrix internally consistent

**Catatan status "READY":** 13 dari 13 open question sudah di-resolve. Tidak ada item PENDING tersisa.

✅ **PRD READY FOR EXTRACTION** — Save as `prd.md` → Run Prompt 01.
