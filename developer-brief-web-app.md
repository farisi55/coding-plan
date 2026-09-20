# Developer Brief — Web App

> Bagian dari sistem **multi-platform** (Appendix I). Companion unit: `developer-brief-cli-tool.md`.
> Status: draft final-app scope (bukan MVP). Beberapa field masih perlu konfirmasi kamu — ditandai eksplisit di bawah.

PROJECT SHAPE: fullstack

PROJECT NAME: **coding-plan** (dikonfirmasi dipakai untuk fase MVP/gratis; brand konsumen formal dipertimbangkan ulang saat fitur berbayar live)

ONE-LINE PURPOSE: Mengubah ide produk software (atau codebase yang sudah berjalan) menjadi PRD terstruktur berbasis Fase → Fitur → Sub-fitur yang siap dieksekusi AI coding agent.

PRIMARY USERS: Solo developer, tim kecil, atau technical founder MSME yang pakai AI coding agent (Claude Code, Cursor, Codex, dll) dan butuh planning/spec sebelum mulai ngoding.

CORE FEATURES (3–7):
  1. Idea-to-PRD generator — input ide, wizard klarifikasi (maks 5 pertanyaan, bisa di-skip), pilih model AI, hasil PRD terstruktur (Fase/Fitur/Sub-fitur)
  2. Existing-project flow — layar bootstrap (token sekali-pakai + instruksi CLI), mind-map hasil sync dengan status per fitur direkonsiliasi dari bukti kode nyata (bukan default "planned" — untuk codebase eksisting, fitur yang sudah ada harus kebaca "selesai"), chat "Workspace Agent" (tanya-jawab berbasis RAG atas ringkasan codebase), 3 opsi delivery: download PRD.md, download ZIP (PRD + spec per-fitur + task), atau prompt AI agent untuk eksekusi otomatis (lihat `developer-brief-cli-tool.md`)
  3. Project & PRD dashboard — riwayat semua project, buka ulang / generate ulang PRD, lihat status tiap fitur (planned/in progress/done)
  4. Multi-model AI selection via OpenRouter gateway
  5. Autentikasi (Google OAuth + email magic link) dan manajemen sesi
  6. Subscription & billing (Free/Starter/Pro) dengan enforcement kuota generate bulanan — *ditunda untuk sprint MVP awal, tapi termasuk cakupan final app ini*
  7. Community & consultation — link keluar ke komunitas (Discord) + form kontak untuk layanan konsultasi custom

> **Catatan desain (dari hasil coba fitur existing-project kompetitor):** file PRD & spec fitur mereka selalu menyertakan kriteria "Selesai bila" eksplisit per sub-fitur, bukan cuma nama + deskripsi. Ini best practice yang layak diadopsi independen — kriteria selesai yang jelas jauh lebih actionable buat AI coding agent dibanding deskripsi naratif. **Rekomendasi:** tambah field `definitionOfDone` (atau `acceptanceCriteria`) ke schema `subFeatures` di kedua flow (baru & existing) — ini perubahan schema, belum saya terapkan ke kode MVP, tunggu konfirmasi kamu dulu.

> **FYI soal auth (bukan blocking):** NextAuth.js/Auth.js sekarang di bawah naungan tim Better Auth (Auth.js gabung September 2025, lalu Better Auth sendiri diakuisisi Vercel). Auth.js masih dapat security patch dan `@auth/d1-adapter`-nya terbukti jalan di Cloudflare Workers — jadi keputusan NextAuth kita tetap valid buat Cloudflare. Cuma perlu tahu: fitur baru ke depannya lebih banyak masuk ke Better Auth, bukan Auth.js. Bukan sesuatu yang perlu diubah sekarang.

TECH STACK PREFERENCES:
  - Language/Runtime: TypeScript / Node.js *(sudah diputuskan)*
  - Framework: Next.js, App Router — **perlu upgrade dari v14 ke v15/16.** Adapter Cloudflare (`@opennextjs/cloudflare`) menghentikan dukungan Next.js 14 sejak Q1 2026; MVP yang sudah jalan masih di v14
  - Database: **Cloudflare D1** (SQLite, via Prisma `@prisma/adapter-d1`) menggantikan PostgreSQL — free tier 5GB storage + 5M read/write per bulan. Dua catatan penting: (1) D1 **tidak dukung transaction asli** — Prisma menjalankan `$transaction()` sebagai query terpisah, jadi operasi yang butuh atomicity (mis. create project + increment quota) perlu didesain ulang biar toleran partial-failure; (2) enum Postgres jadi string biasa di SQLite — migrasi schema kecil tapi bukan blocker. Vector search buat Workspace Agent chat pindah ke Cloudflare Vectorize (lihat baris Key third-party services)
  - Hosting/Infra: **Cloudflare Workers** via adapter `@opennextjs/cloudflare` — bukan lagi Vercel, sesuai keputusan kamu. Free tier: 100K request/hari, 10ms CPU time per request, 64 MiB ukuran Worker (batas lama 1-3MB sudah dihapus per Mei 2026, jadi ukuran bundle bukan masalah lagi). **Yang perlu dipantau:** 10ms CPU/request itu ketat untuk halaman yang sekaligus SSR + cek auth + query DB — kalau kena limit, upgrade ke Workers Paid ($5/bulan) langsung naik ke 30 detik CPU default, tetap sangat murah, bukan lagi soal "gratis total"
  - Key third-party services and webhook providers: OpenRouter (AI gateway, tetap), **Cloudflare Vectorize + Workers AI** (ganti pgvector — buat RAG Workspace Agent chat, sama-sama free tier: Vectorize 30M queried dimensions/bulan, Workers AI 10K inferensi/hari), **Resend lewat HTTP API** (BUKAN SMTP — Cloudflare, seperti hampir semua platform edge/cloud, blokir outbound SMTP port 25/587 by default untuk cegah spam abuse; kode NextAuth yang sudah ada pakai `nodemailer`+SMTP, ini perlu diganti ke Resend API), **Xendit** (payment gateway, dikonfirmasi — webhook via HTTPS tetap jalan normal di Workers)

API CONSUMERS:
  - Does this API have consumers outside this project? **Ya** — CLI companion tool adalah konsumer eksternal: memanggil endpoint auth/bootstrap dan endpoint ingest-summary di backend ini. Auth CLI **dikonfirmasi**: OAuth browser-based, backend tampilkan URL callback berisi token sekali-tukar yang di-copy-paste user ke terminal (bukan device-code flow terpisah) — butuh entity baru `CliToken` di schema.

OBSERVABILITY:
  - Log destination: **rekomendasi** — log bawaan Workers (Cloudflare dashboard, aktifkan `observability.enabled` di wrangler config), upgrade ke layanan terpisah (Axiom/Better Stack) kalau volume naik. *Perlu dikonfirmasi.*
  - Error tracking: **rekomendasi** Sentry (free tier cukup di tahap awal)
  - Alerting: **rekomendasi** notifikasi Slack/email untuk error kritis (kegagalan pembayaran, AI provider down). *Channel spesifik perlu dikonfirmasi.*

BACKUP & RECOVERY:
  - Backup strategy: **D1 Time Travel** — restore bawaan, selalu aktif otomatis, gratis, tanpa setup manual. Ini upgrade dari asumsi awal (backup harian manual), bukan downgrade — D1 justru lebih baik di area ini daripada rencana Postgres sebelumnya
  - Max acceptable data loss (RPO): granularity per-menit, ke titik manapun dalam 30 hari terakhir — jauh lebih baik dari asumsi awal ≤24 jam
  - Recovery time target (RTO): cepat (command restore lewat Wrangler/API), tapi tetap wajib di-tes manual dulu sebelum diandalkan saat insiden nyata

SCALE EXPECTATION:
  - Concurrent users / usage volume 6 bulan pertama: **100 pengunjung/bulan (dikonfirmasi)**.

HARD CONSTRAINTS:
  - Solo developer — bandwidth terbatas, hindari arsitektur yang butuh tim ops
  - Tidak boleh replikasi verbatim UI copy, desain visual, atau teks prompt dari ngodingpakeai.com — konsep sama, implementasi & branding sendiri
  - Stack: Next.js (v15/16, App Router) + Cloudflare Workers + D1 — deploy 100% di Cloudflare free tier, sesuai keputusan kamu
  - Next.js wajib di-upgrade dari v14 sebelum deploy — adapter Cloudflare sudah stop dukung v14
  - UU PDP (Indonesia) dikonfirmasi berlaku, review compliance diminta **di awal**, bukan ditunda — lihat `prd.md` §6.4 untuk starting point (bukan pengganti konsultasi hukum profesional)

OUT OF SCOPE:
  - Visualisasi node-graph/mind-map interaktif (pan/zoom) — v1 pakai list per-fase yang bisa di-expand
  - White-labeling / fitur multi-tenant enterprise
  - Native mobile app
  - Real-time collaborative editing PRD (multi-user simultan)
