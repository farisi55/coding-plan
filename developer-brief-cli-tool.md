# Developer Brief — CLI Tool

> Bagian dari sistem **multi-platform** (Appendix I). Companion unit: `developer-brief-web-app.md`.
> Status: draft final-app scope. Command name & wording di bawah pakai placeholder — original kita sendiri, bukan copy dari `npx ngodingpakeai`.
> **Soal keputusan hosting Cloudflare:** tidak relevan di sini. CLI ini tidak di-deploy ke mana pun — dia npm package yang jalan di mesin developer lewat `npx`. Hanya backend (`developer-brief-web-app.md`) yang perlu keputusan hosting.

PROJECT SHAPE: cli-worker

PROJECT NAME: `<brand>-cli` *(working title — ikut nama brand final di developer-brief-web-app.md)*

ONE-LINE PURPOSE: CLI yang menjembatani AI coding agent lokal (Claude Code, Cursor, Codex, dll) dengan backend `<brand>` — sync ringkasan codebase (bukan source mentah) dan menjalankan task plan satu-per-satu dengan checkpoint antar fase/layer.

PRIMARY USERS: Sama seperti web app — developer yang sudah punya codebase jalan dan mau AI coding agent-nya kerja dari task plan terstruktur, bukan asal-asalan baca seluruh repo tiap sesi.

CORE FEATURES (3–7):
  1. Login (OAuth browser-based, dikonfirmasi) + connect + install skill (sekali jalan) — CLI cetak URL otorisasi, user login di browser (reuse Google OAuth/email magic-link punya web app), backend tampilkan URL callback berisi token sekali-tukar yang di-copy-paste user balik ke terminal (dipilih karena CLI tidak selalu bisa jalankan local HTTP listener, mis. environment remote/SSH/container); token disimpan lokal, ikat repo ke workspace, tulis config binding lokal (cuma ID, aman di-commit), pasang skill file ke direktori agent yang terdeteksi (`.claude/skills/`, `.cursor/skills/`, `.codex/skills/`, dll)
  2. Ambil PRD/plan sekali di awal sesi — fetch PRD lengkap dari server sebagai konteks kerja agent
  3. Sync codebase (initial + incremental `--if-changed`) — ringkasan ditulis AI agent secara lokal (bukan CLI), raw source tidak pernah diupload; untuk codebase existing, status tiap fitur/sub-fitur **direkonsiliasi dari bukti kode** (sudah ada vs belum), bukan default "planned" untuk semua
  4. Task execution loop dengan checkpoint fase/layer — server tentukan urutan task berikutnya; agent kerja satu task sampai selesai, lalu **berhenti & lapor** tiap kali fase bertambah atau layer berganti (mis. frontend → backend), tunggu instruksi lanjut dari user sebelum ambil task berikutnya
  5. Resiliency rules bawaan skill — instruksi eksplisit "kalau stuck, laporkan alasan lalu lanjut ke task berikutnya (jangan diam)" dan "reset status task ke belum-selesai hanya kalau diminta user secara eksplisit" — mencegah agent macet atau melakukan aksi destruktif tanpa izin
  6. Status command — tampilkan info binding, progress task per fase, waktu sync terakhir, jumlah file ter-index

TECH STACK PREFERENCES:
  - Language/Runtime: Node.js *(konsisten dengan ekosistem JS web app — bisa jalan via `npx` tanpa install manual)*
  - Framework: Commander.js atau oclif untuk command parsing — tidak butuh web framework
  - Database (leave blank / "none"...): none — satu-satunya state lokal adalah file config binding di repo user
  - Hosting/Infra (backend-api/fullstack/microservices only): N/A — shape ini `cli-worker`, field tidak berlaku
  - Key third-party services and webhook providers: publish ke npm registry; komunikasi ke backend `<brand>` lewat HTTPS (bukan webhook)

API CONSUMERS:
  - N/A — field ini scoped untuk backend-api/fullstack/microservices. CLI berperan sebagai *consumer* API backend (lihat `developer-brief-web-app.md`), bukan penyedia API.

OBSERVABILITY:
  - Log destination: stdout/stderr lokal saja — tidak ada server-side log untuk proses CLI itu sendiri
  - Error tracking: opsional kirim crash report (dengan consent eksplisit saat pertama jalan) ke Sentry milik backend, supaya tim tahu kalau banyak user macet di step tertentu
  - Alerting: N/A untuk CLI — alerting relevan di sisi backend

BACKUP & RECOVERY: N/A — CLI tidak menyimpan data yang jadi tanggung jawab kita untuk di-backup; state ada di repo milik user sendiri

SCALE EXPECTATION:
  - Mengikuti subset user web app yang memilih pakai fitur "existing project" — dari basis 100 pengunjung/bulan (dikonfirmasi di `developer-brief-web-app.md`), jadi subset ini kemungkinan kecil banget di fase awal

HARD CONSTRAINTS:
  - Wajib: raw source code **tidak pernah** diupload — hanya metadata file + ringkasan yang ditulis AI agent secara lokal
  - Harus jalan tanpa instalasi global wajib (`npx`-friendly)
  - Command name, wording skill/prompt, dan path config harus original — bukan hasil copy dari CLI atau SKILL.md milik ngodingpakeai
  - Checkpoint wajib ada di task loop (berhenti tiap ganti fase/layer) — bukan sekadar meniru kompetitor, tapi prinsip keamanan: user harus bisa verifikasi manual sebelum agent lanjut ke bagian berikutnya, apalagi sebelum menyentuh layer backend/data

OUT OF SCOPE:
  - Real-time file watcher (auto-sync tanpa command manual) — v1 tetap manual trigger
  - Enkripsi end-to-end konten summary — v1 cukup HTTPS transport
  - Analisis codebase non-text/binary (mis. compiled assets, gambar)
  - Auto-loop tanpa checkpoint (mengerjakan banyak task sekaligus tanpa berhenti) — sengaja tidak dibuat opsional, konsisten dengan hard constraint checkpoint di atas
