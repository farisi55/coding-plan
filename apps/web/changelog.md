---
project: coding-plan
knowledge_version: 1.0.3
changelog_version: 1.0.4
created: 2026-09-18
status: in_progress
milestone: 1 of 2
project_shape: fullstack
simple_mode: false
---

<!--
Milestone 1 scope: Foundation (Phase 1), Domain & Data (Phase 2), hardening +
CLI-auth for already-started Core Features (Phase 3), Integration resilience
for existing third-party calls (Phase 4), one UI/UX safety audit (Phase 5),
coverage to target (Phase 6), first real deployment (Phase 7).

Milestone 2 (not yet planned in task form): existing-project flow (CLI sync,
Workspace Agent RAG chat, 3 delivery options), Project & PRD dashboard,
Xendit billing integration + webhook, Community & consultation. These are
substantial new features better scoped in detail when this milestone starts,
not rushed here.

Two Phase 7 criteria from the template are marked N/A with reasoning rather
than silently dropped:
- Canary/staged-rollout: N/A — knowledge.md §8 states no canary strategy is
  defined (target far below the 1,000-user threshold that would require one).
- SIGTERM graceful drain: N/A in the traditional sense — Cloudflare Workers'
  request-scoped execution model has no long-running process to signal;
  in-flight request completion during deploys is a platform-level guarantee,
  not app code this project implements.
-->

## [IN PROGRESS]

### Task #003 — CI Pipeline (lint → type-check → test → security-scan)
- **Phase:** Foundation
- **Scope:** GitHub Actions workflow running lint, typecheck, test, and a dependency security scan on every push. Repo is now an npm workspaces monorepo (see Task #001 follow-up restructure) — commands run at root with `--workspace=apps/web` or `npm run <script> -w apps/web`, not bare `npm run lint`
- **Files to create / modify:** `.github/workflows/ci.yml` (new, at repo root — GitHub Actions always discovers workflows there regardless of workspace layout)
- **Acceptance criteria:**
  - [ ] Workflow runs lint/typecheck/test/audit scoped to `apps/web` (the only workspace with real code so far) in sequence
  - [ ] A PR with an intentionally broken lint rule fails the workflow
- **Dependencies:** Task #001, #002
- **Decisions made:** (fill after execution — never leave blank)

---

## [NEXT TASKS]

### Phase 1 — Foundation

### Task #004 — Structured Logging & Error Tracking Init
- **Phase:** Foundation
- **Scope:** Initialize Sentry with PII/secret scrubbing enabled before any event is sent
- **Files to create / modify:** `apps/web/src/lib/sentry.ts` (new), `apps/web/next.config.mjs` (modify), `apps/web/wrangler.jsonc` (add env var)
- **Acceptance criteria:**
  - [ ] Sentry captures an intentionally thrown test error in a non-prod environment
  - [ ] A test event containing a fake email/token in its payload is scrubbed before send (unit-tested via the `beforeSend` hook)
- **Dependencies:** none
- **Decisions made:** (fill after execution — never leave blank)

### Task #005 — Health Check Endpoint
- **Phase:** Foundation
- **Scope:** Add `GET /api/health` returning status, D1 connectivity, and app version
- **Files to create / modify:** `apps/web/src/app/api/health/route.ts` (new)
- **Acceptance criteria:**
  - [ ] Returns 200 with `{ status: "ok", db: "ok", version }` when D1 is reachable
  - [ ] Returns 503 with `db: "error"` when the internal D1 check query fails
- **Dependencies:** none
- **Decisions made:** (fill after execution — never leave blank)

### Task #006 — Startup Env Var Validation
- **Phase:** Foundation
- **Scope:** Validate required env vars with zod at first use; fail fast with a clear error instead of a cryptic downstream crash
- **Files to create / modify:** `apps/web/src/lib/env.ts` (new), `apps/web/src/lib/auth.ts` (modify), `apps/web/src/lib/openrouter.ts` (modify)
- **Acceptance criteria:**
  - [ ] A missing `OPENROUTER_API_KEY` produces a clear `EnvValidationError`, not a raw fetch failure
  - [ ] Unit test written and passing for new logic
  - [ ] Test is isolated: sets up and tears down its own state
- **Dependencies:** none
- **Decisions made:** (fill after execution — never leave blank)

### Phase 2 — Domain & Data

### Task #007 — Apply & Verify Initial D1 Migration
- **Phase:** Domain & Data
- **Scope:** Generate and apply the first D1 migration for all 7 entities (User, Account, Session, VerificationToken, Project, Prd, CliToken). **Note:** requires `npx prisma generate` to succeed first — unverified as of the Prisma 7 upgrade (sandbox network limitation, see knowledge.md §2); confirm this works before starting this task
- **Files to create / modify:** `apps/web/migrations/0001_init.sql` (new)
- **Acceptance criteria:**
  - [ ] `npm run prisma:migrate` applies cleanly to a fresh local D1 instance with zero errors
  - [ ] `PRAGMA table_info(...)` output for every table matches knowledge.md §7 exactly (columns, types, nullability, defaults)
- **Migration safety:**
  - [ ] Schema matches @knowledge §7 Data Schema exactly
  - [ ] Down migration written and tested (drop tables in reverse FK order)
  - [ ] Migration is idempotent (safe to re-run)
  - [ ] Delete strategy matches @knowledge §7 — hard-delete cascade verified on all 5 FKs (`Account.userId`, `Session.userId`, `Project.userId`, `Prd.projectId`, `CliToken.userId`)
  - [ ] No live-traffic tables exist yet at this stage — non-blocking pattern not yet applicable
- **Dependencies:** none
- **Decisions made:** (fill after execution — never leave blank)

### Task #008 — Inactive-Account Retention Job
- **Phase:** Domain & Data
- **Scope:** Cloudflare Cron Trigger — 30-day warning email at 60 days inactive, hard-delete at 90 days inactive, per knowledge.md §7
- **Files to create / modify:** `apps/web/src/cron/retention.ts` (new), `apps/web/wrangler.jsonc` (add `[triggers]` block)
- **Acceptance criteria:**
  - [ ] A user with `lastActiveAt` 61 days ago receives exactly one warning email and is not deleted
  - [ ] A user with `lastActiveAt` 91 days ago is hard-deleted (Project/Prd/Account/Session/CliToken all cascade)
- **Migration safety:** N/A — no schema change, `lastActiveAt` already exists from Task #007
- **Dependencies:** Task #007
- **Decisions made:** (fill after execution — never leave blank)

### Phase 3 — Core Features

### Task #009 — Unit Tests: PRD Generation & Validation Logic
- **Phase:** Core Features
- **Scope:** Test `generatePrd()`'s JSON extraction, zod validation, and error paths (`slugify` already covered)
- **Files to create / modify:** `apps/web/src/lib/openrouter.test.ts` (extend)
- **Acceptance criteria:**
  - [ ] Valid JSON, fenced-JSON, and malformed-JSON responses each produce the expected result/error
  - [ ] Unit test written and passing for new logic
  - [ ] Test is isolated: sets up and tears down its own state (mocked `fetch` per test)
- **Dependencies:** none
- **Decisions made:** (fill after execution — never leave blank)

### Task #010 — Unit Tests: Auth Session & Quota Logic
- **Phase:** Core Features
- **Scope:** Test the session callback in `getAuthOptions()` and the month-rollover quota-reset logic in `/api/generate`
- **Files to create / modify:** `apps/web/src/lib/auth.test.ts` (new), `apps/web/src/app/api/generate/route.test.ts` (new)
- **Acceptance criteria:**
  - [ ] Session callback attaches `id` and `plan` to `session.user` correctly
  - [ ] Quota resets to 0 only when `now > quotaResetAt`, never otherwise
  - [ ] Unit test written and passing for new logic
  - [ ] Test is isolated: sets up and tears down its own state
- **Dependencies:** none
- **Decisions made:** (fill after execution — never leave blank)

### Task #011 — CLI Auth: Start Endpoint (OAuth Kickoff)
- **Phase:** Core Features
- **Scope:** `GET /api/cli-auth/start` begins the browser-based OAuth flow for CLI login, reusing the existing Google provider
- **Files to create / modify:** `apps/web/src/app/api/cli-auth/start/route.ts` (new)
- **Acceptance criteria:**
  - [ ] Visiting the endpoint redirects to Google OAuth consent with a `state` param bound to the request
  - [ ] Unit test written and passing for state generation/validation
  - [ ] Test is isolated: sets up and tears down its own state
- **Dependencies:** Task #007 (CliToken table must exist)
- **Decisions made:** (fill after execution — never leave blank)

### Task #012 — CLI Auth: Callback & One-Time Token Issuance
- **Phase:** Core Features
- **Scope:** OAuth callback creates/looks up the User, issues a one-time CLI token, stores its hash, shows a copy-paste page
- **Files to create / modify:** `apps/web/src/app/api/cli-auth/callback/route.ts` (new), `apps/web/src/app/cli-auth/success/page.tsx` (new)
- **Acceptance criteria:**
  - [ ] A successful callback creates exactly one `CliToken` row (hash only, never plaintext) and shows the plaintext token exactly once
  - [ ] A `state` that doesn't match an in-flight request is rejected (CSRF protection)
  - [ ] Unit test written and passing for the hashing/issuance logic
  - [ ] Test is isolated: sets up and tears down its own state
- **Dependencies:** Task #011
- **Decisions made:** (fill after execution — never leave blank)

### Phase 4 — Integration

### Task #013 — OpenRouter Call: Timeout & Circuit Breaker
- **Phase:** Integration
- **Scope:** Wrap the OpenRouter fetch with a request timeout and a circuit breaker (required — `simple_mode: false`)
- **Files to create / modify:** `apps/web/src/lib/openrouter.ts` (modify), `apps/web/src/lib/circuit-breaker.ts` (new)
- **Acceptance criteria:**
  - [ ] A request exceeding 30s aborts with a clear timeout error instead of hanging
  - [ ] After 5 consecutive failures the circuit opens (fails fast, no network call) for a cooldown window, then half-opens to test recovery
- **Dependencies:** none
- **Decisions made:** (fill after execution — never leave blank)

### Task #014 — Resend Call: Timeout Handling
- **Phase:** Integration
- **Scope:** Add a request timeout to the Resend send call so a slow API doesn't block magic-link login indefinitely
- **Files to create / modify:** `apps/web/src/lib/auth.ts` (modify)
- **Acceptance criteria:**
  - [ ] A call exceeding 10s aborts and surfaces a clear "couldn't send login email" error
  - [ ] Existing successful-send path is unaffected (regression-checked)
- **Dependencies:** none
- **Decisions made:** (fill after execution — never leave blank)

### Phase 5 — UI/UX

### Task #015 — Verify XSS Safety of AI-Generated Content Rendering
- **Phase:** UI/UX
- **Scope:** Audit that AI-generated PRD content (names, descriptions, overview) can never execute as HTML/script in `PrdGenerator.tsx`
- **Files to create / modify:** `apps/web/src/components/PrdGenerator.tsx` (audit; no functional change expected)
- **Acceptance criteria:**
  - [ ] Codebase contains zero uses of `dangerouslySetInnerHTML` for AI-generated content
  - [ ] A PRD generated from an idea containing `<script>alert(1)</script>`-style text renders as literal visible text, documented and verified
- **Dependencies:** none
- **Decisions made:** (fill after execution — never leave blank)

### Phase 6 — Testing & QA

### Task #016 — Coverage: `apps/web/src/lib/*` Modules to 80%
- **Phase:** Testing & QA
- **Scope:** Close coverage gaps in `auth.ts`, `db.ts`, `openrouter.ts`, `api-response.ts` to meet the >80% target (knowledge.md §4)
- **Files to create / modify:** existing `*.test.ts` files (extend/add)
- **Acceptance criteria:**
  - [ ] `npm run test:coverage` reports ≥80% lines/functions/branches/statements for everything under `apps/web/src/lib/`
  - [ ] No test makes a live network call (OpenRouter/Resend mocked)
- **Dependencies:** Task #009, #010, #013, #014
- **Decisions made:** (fill after execution — never leave blank)

### Task #017 — Coverage: API Routes & Components to 80%
- **Phase:** Testing & QA
- **Scope:** Close coverage gaps in `apps/web/src/app/api/*/route.ts` and `PrdGenerator.tsx` to meet the >80% target overall
- **Files to create / modify:** `apps/web/src/app/api/generate/route.test.ts` (extend), `apps/web/src/components/PrdGenerator.test.tsx` (new)
- **Acceptance criteria:**
  - [ ] `npm run test:coverage` reports ≥80% across the full `apps/web/src/` tree
  - [ ] Coverage report visible in CI output
- **Dependencies:** Task #016, #003
- **Decisions made:** (fill after execution — never leave blank)

### Phase 7 — Deployment (Server variant)

### Task #018 — Version Tagging & Rollback Procedure
- **Phase:** Deployment
- **Scope:** Establish the git tag format and a tested rollback procedure
- **Files to create / modify:** `apps/web/docs/deployment.md` (new)
- **Acceptance criteria:**
  - [ ] A git tag in the documented format (e.g. `v0.2.0`) exists for the current state
  - [ ] Redeploying the previous tag to staging completes in under 10 minutes, verified once
- **Dependencies:** none
- **Decisions made:** (fill after execution — never leave blank)

### Task #019 — Staging Deploy, Smoke Test & Env Var Verification
- **Phase:** Deployment
- **Scope:** Deploy to Cloudflare Workers staging, confirm required env vars, smoke-test the idea-to-PRD flow end-to-end
- **Files to create / modify:** `apps/web/wrangler.jsonc` (add staging environment), `apps/web/docs/deployment.md` (extend)
- **Acceptance criteria:**
  - [ ] All 9 required env vars (knowledge.md §8) confirmed present in staging
  - [ ] A full login → generate PRD → view result flow succeeds in staging with zero errors
  - [ ] `GET /api/health` (Task #005) returns 200 in staging
- **Dependencies:** Task #005, #006, #007
- **Decisions made:** (fill after execution — never leave blank)

### Task #020 — Load Test: Smoke & Capacity Stages
- **Phase:** Deployment
- **Scope:** Run both required load-test stages against staging (`simple_mode: false` — Stage 2 is not skipped)
- **Files to create / modify:** `apps/web/load-test/k6-script.js` (new), `apps/web/docs/deployment.md` (append results)
- **Acceptance criteria:**
  - [ ] Stage 1 (Smoke: 10 VU / 60s) completes with zero 5xx errors
  - [ ] Stage 2 (Capacity: 50 VU minimum, 2 min) completes with P95/P99/error-rate recorded, memory at end ≤120% of start, zero 5xx during a mid-test deploy
- **Dependencies:** Task #019
- **Decisions made:** (fill after execution — never leave blank)

### Task #021 — Backup Restore Test (D1 Time Travel)
- **Phase:** Deployment
- **Scope:** Verify D1 Time Travel restore works — restore staging to 10+ minutes in the past and confirm data integrity
- **Files to create / modify:** `apps/web/docs/deployment.md` (append restore runbook)
- **Acceptance criteria:**
  - [ ] `wrangler d1 time-travel restore` successfully restores staging D1 to a prior timestamp
  - [ ] Post-restore row counts for User/Project/Prd match the expected pre-restore state
- **Dependencies:** Task #007, #019
- **Decisions made:** (fill after execution — never leave blank)

### Task #022 — API Documentation
- **Phase:** Deployment
- **Scope:** Generate `apps/web/docs/api.yaml` (OpenAPI) covering `/api/generate`, `/api/health`, `/api/cli-auth/*`, verified against the running staging server
- **Files to create / modify:** `apps/web/docs/api.yaml` (new)
- **Acceptance criteria:**
  - [ ] Every route implemented as of this milestone has an OpenAPI entry matching the `{ data, error }` envelope
  - [ ] `swagger-cli validate` (or equivalent) passes with zero errors
- **Dependencies:** Task #011, #012, #019
- **Decisions made:** (fill after execution — never leave blank)

---

## [COMPLETED]
> Changelog v1.0.0 initialized from @knowledge v1.0.0. Shape: fullstack.

### Task #001 — Git Hygiene & Pre-commit Secret Guard ✅
- **Completed:** 2026-09-19
- **Phase:** Foundation
- **Status:** OK
- **Branch:** feat/task-001-git-hygiene-precommit-secret-guard
- **Files created / modified:**
  - `.gitignore` — excludes `.env`, `*.pem`, `*.key`, `*.p12`, `secrets/`, build artifacts
  - `.husky/pre-commit` — blocks any commit staging a real `.env` file (allows `.env.example`)
- **Acceptance criteria met:**
  - [x] `.gitignore` excludes `.env`, `*.pem`, `*.key`, `*.p12`, `secrets/`, `node_modules/`, `.next/`, `.open-next/`, `.wrangler/`
  - [x] A test commit staging `.env` is rejected by the pre-commit hook (tested live: blocked with exit 1; legitimate commit without `.env` staged succeeded; `.env.example` confirmed NOT blocked)
- **Security gate:** BASIC — all applicable checks passed. CORS and CI-secret-masking items: N/A, nothing to audit yet (no CORS config or CI pipeline exists — out of this task's scope)
- **Scalability gate:** BASIC — all items N/A, this task touches zero runtime code
- **Regression:** NOT RUN — pre-existing, task-unrelated `npm install` blocker (see Notes below); zero lintable/buildable files were touched by this task
- **Decisions made:**
  - [INFRA] Used git's native `core.hooksPath = .husky` instead of installing the `husky` npm package — identical behavior (this is what Husky v9 itself does internally); avoids adding an unverified dependency while `npm install` is broken project-wide
  - [INFRA] Dropped `lint-staged` from this task's scope — not needed for the stated acceptance criteria (blocking `.env`, not linting-on-commit); can be its own task later if wanted
  - [ARCH] Initialized git with `main` (stable) + `dev` (integration) branches per the project's git strategy, before branching `feat/task-001-...` off `dev`
- **Notes:** **`npm install` is currently broken for the whole project.** `@opennextjs/cloudflare@^0.6.0` (pinned in `package.json`) hardcodes a dependency on `https://pkg.pr.new/@opennextjs/aws@798` — a prerelease-build host outside this environment's network allowlist. Separately and more importantly: that package has moved fast — `^0.6.0` is now many versions behind current latest (`1.20.6`), and `^0.6.0` would never auto-upgrade past `0.x` under semver even where the install succeeds. **This blocks Task #002 (lockfile) until resolved** — recommend re-pinning to a current `1.x` version as the first action of Task #002, not deferring further.
- **Knowledge drift:** UPDATE REQUIRED: @knowledge §3 — added `.husky/pre-commit` to the folder structure (new top-level `.husky/` folder); already applied, `knowledge_version` bumped to 1.0.1

### Task #002 — Commit Dependency Lockfile ✅
- **Completed:** 2026-09-23
- **Phase:** Foundation
- **Status:** OK
- **Branch:** feat/task-002-commit-dependency-lockfile
- **Files created / modified:**
  - `package-lock.json` (repo root) — verified present, tracked, in sync (regenerated/confirmed by `npm install`; lockfileVersion 3, 555 KB, 879 packages)
  - `apps/web/eslint.config.mjs` — added ignores for generated/build artifacts (`.next/`, `.open-next/`, `src/generated/`, `next-env.d.ts`, `coverage/`) so `npm run lint` reflects real source only
- **Acceptance criteria met:**
  - [x] `package-lock.json` exists and is committed
  - [x] `npm ci` on a clean checkout completes with zero errors (added 879 packages in 5m, exit 0)
- **Security gate:** BASIC — all checks passed (CORS/CI-secret/container items N/A; pre-commit `.env` block re-tested live: blocked with exit 1)
- **Scalability gate:** BASIC — all items N/A, task touches no runtime code
- **Regression:** Phase 1 build OK — `npm run build` exit 0; `npm run lint` exit 0 (0 errors after ignore fix); `npm test` → 1 file, 3 passed, 0 failed, 900ms
- **Decisions made:**
  - [INFRA] ESLint ignores extended to gitignored build/generated trees instead of linting `.next/` output — the prior 183 "errors" were 100% artifacts (`.next/`, `src/generated/`, `next-env.d.ts`), zero in real source; CI (Task #003) would have failed permanently otherwise
  - [INFRA] Lockfile kept at monorepo root (npm workspaces single lockfile) — one `npm ci` covers all workspaces; no per-workspace lockfiles
- **Notes:** none — Task #001's `@opennextjs/cloudflare@^0.6.0` blocker already resolved by the `^1.x` bump recorded in @knowledge §2; `npm install`/`npm ci` both succeed. npm warns that 7 packages have unapproved install scripts (prisma/esbuild/workerd) — benign, scripts not required for lint/build/test; revisit if `prisma generate` needs `@prisma/engines` postinstall (known sandbox limitation, @knowledge §2)
- **Knowledge drift:** none
