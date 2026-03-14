# MaternaTrack

A production-grade maternal care coordination dashboard for nurse care partners managing high-risk pregnancies.

**Live features:** AI clinical decision support · Real-time vital escalation · FHIR R4 API · Population cohort builder · Patient portal · Compliance reporting · Predictive risk analytics · Provider handoffs · Neonatal tracking

---

## Demo Credentials

### Provider (Dashboard)
| Role    | Email                 | Password    |
|---------|-----------------------|-------------|
| Nurse   | nurse@materna.dev     | password123 |
| Midwife | midwife@materna.dev   | password123 |
| Admin   | admin@materna.dev     | password123 |

### Patient (Portal)
| Patient  | Email                      | Password    |
|----------|----------------------------|-------------|
| Sarah    | sarah@patient.dev          | patient123  |
| Maria    | maria@patient.dev          | patient123  |
| Aisha    | aisha@patient.dev          | patient123  |
| Jennifer | jennifer@patient.dev       | patient123  |
| Keiko    | keiko@patient.dev          | patient123  |

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker (for PostgreSQL)

### 1. Clone and install
```bash
git clone <repo>
cd materna-track
npm install
```

### 2. Start the database
```bash
docker compose up -d
```

### 3. Configure environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/materna_track"
NEXTAUTH_SECRET="your-random-secret"
NEXTAUTH_URL="http://localhost:3000"

# AI Provider — "groq" (free) or "anthropic" (paid)
AI_PROVIDER="groq"
GROQ_API_KEY="gsk_..."        # Free at console.groq.com
GROQ_MODEL="llama-3.3-70b-versatile"

# Optional — only needed if AI_PROVIDER=anthropic
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-haiku-4-5-20251001"
```

### 4. Migrate and seed
```bash
npm run db:migrate
npm run db:seed
```

### 5. Run the app
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the demo credentials above.
Patient portal: [http://localhost:3000/portal](http://localhost:3000/portal)

---

## Tech Stack

| Layer       | Technology                                           |
|-------------|------------------------------------------------------|
| Framework   | Next.js 16 (App Router, React Server Components)     |
| Language    | TypeScript (strict mode, no `any`)                   |
| Database    | PostgreSQL 16 via Docker                             |
| ORM         | Prisma 7 (`@prisma/adapter-pg`)                      |
| Auth        | NextAuth.js v5 — credentials provider (JWT)          |
| AI          | Multi-provider: Groq (Llama 3.3 70B) + Anthropic Claude |
| Styling     | Tailwind CSS 4 + shadcn/ui + next-themes (dark mode) |
| Charts      | Recharts 3                                           |
| Validation  | Zod 4 (all inputs, server actions, API routes)       |
| Testing     | Vitest (unit) + Playwright (E2E)                     |
| Real-time   | Server-Sent Events (SSE)                             |
| PDF Export  | @react-pdf/renderer                                  |
| CI/CD       | GitHub Actions (lint → typecheck → unit → build → E2E) |

---

## Architecture

### Project Structure
```
src/
  app/
    login/                         # Provider auth page
    portal/                        # Patient-facing portal (separate auth)
      login/
      (app)/dashboard|messages|care-plan|vitals|appointments/
    dashboard/
      page.tsx                     # Patient panel with morning briefing + AI worklist
      layout.tsx                   # Responsive sidebar + header shell
      patients/[id]/page.tsx       # Patient detail (RSC)
      analytics/page.tsx           # Aggregate charts + AI panel summary
      cohorts/page.tsx             # Population cohort builder (URL-driven filters)
      appointments/page.tsx        # Calendar view of all appointments
      admin/
        users/page.tsx             # Provider management (admin only)
        audit-log/page.tsx         # Audit trail with filtering + export
        performance/page.tsx       # Provider performance metrics
      compliance/page.tsx          # ACOG/USPSTF/SMFM guideline adherence
    actions/
      patient-actions.ts           # CRUD, reassignment, multi-provider linking
      vital-actions.ts             # Vital recording + real-time threshold evaluation
      screening-actions.ts         # Screening records + protocol auto-triggers
      appointment-actions.ts       # Scheduling, recurrence, no-show automation
      message-actions.ts           # Messaging + batch outreach
      baby-actions.ts              # Neonatal tracking + birth recording
      care-team-actions.ts         # Care team member management
      handoff-actions.ts           # Provider-to-provider handoff documents
    api/
      ai/
        risk-summary/              # Streaming clinical summary (SSE)
        care-gaps/                 # Streaming care gap analysis (SSE)
        message-draft/             # Streaming message drafting (SSE)
        panel-summary/             # Streaming panel intelligence (SSE)
        visit-note-draft/          # Streaming visit note generation (SSE)
        daily-worklist/            # Streaming AI prioritized worklist (SSE)
        clinical-chat/             # AI copilot chat — RAG over patient record (SSE)
      notifications/               # Notification CRUD + SSE stream
      events/stream/               # SSE push for real-time updates
      export/patient-summary/[id]/ # PDF patient summary download
      fhir/
        Patient/[id]/              # FHIR R4 Patient resource
        Patient/[id]/Observation/  # FHIR R4 Observations bundle
        Patient/[id]/$everything/  # FHIR R4 full patient Bundle
  components/
    dashboard/                     # Sidebar, header, patient cards, notification bell
    patient/                       # Tabbed patient detail (6 tabs + AI copilot)
    analytics/                     # Chart components (compliance, outcomes, adherence)
    appointments/                  # Calendar + scheduling dialog
    cohorts/                       # Filter panel + cohort result list
    admin/                         # Provider performance charts
    onboarding/                    # Multi-step onboarding wizard
    portal/                        # Patient-facing UI components
  hooks/
    use-ai-stream.ts               # SSE consumer hook for AI streaming
    use-notifications.ts           # Real-time notification state + SSE subscription
    use-keyboard-shortcuts.ts      # Global keyboard shortcut registry
  lib/
    ai.ts                          # Multi-provider streaming abstraction
    risk-engine.ts                 # Pure risk scoring function (deterministic)
    risk-predictor.ts              # Linear regression on risk history → trajectories
    alert-rules.ts                 # Cron-driven trend detection (3 consecutive high BPs)
    vital-thresholds.ts            # Real-time ACOG/ADA threshold evaluation on vital save
    notifications.ts               # Notification creation + SSE broadcast
    protocols.ts                   # Care protocol templates + task auto-generation
    protocol-triggers.ts           # Auto-activate protocols on clinical thresholds
    compliance-rules.ts            # ACOG/USPSTF/SMFM rule engine
    fhir-mapper.ts                 # Pure FHIR R4 mapping functions (LOINC codes)
    message-templates.ts           # Pre-built message templates with variable substitution
    pdf-summary.ts                 # React-PDF patient summary template
    export.ts                      # CSV export utility
    db.ts                          # Prisma client singleton
    auth.ts / auth.config.ts       # NextAuth split for edge compatibility
    portal-auth.ts                 # Separate JWT auth for patient portal
prisma/
  schema.prisma                    # Source of truth for data model
  seed.ts                          # 50 clinically coherent patients + babies + vitals
tests/
  risk-engine.test.ts              # 46 unit tests
  e2e/                             # 17 Playwright E2E tests
.github/
  workflows/
    ci.yml                         # Lint → typecheck → Vitest → build → Playwright
```

### Key Architectural Decisions

**React Server Components by default.** Data fetching happens in RSCs using Prisma directly — no extra API layer. `"use client"` is added only for components that need event handlers, hooks, or browser APIs (charts, AI streaming, task interactions).

**Server Actions for mutations.** All form submissions and data mutations use Next.js Server Actions, providing end-to-end type safety and automatic CSRF protection. API routes are reserved for SSE streaming, FHIR, and external integrations.

**Provider isolation at the query layer.** Every database query that returns patient data includes `WHERE providerId = session.user.id OR patientAccesses.providerId = session.user.id`. Middleware protects all `/dashboard/**` routes.

**Multi-provider AI abstraction.** `src/lib/ai.ts` exports a single `generateStream()` function. Feature code never imports `groq` or `anthropic` directly. Switch providers via `AI_PROVIDER=groq|anthropic` — same streaming interface, zero code changes.

**Risk engine as pure function.** `calculateRiskScore(patient, vitals, screenings, tasks)` is fully deterministic, side-effect-free, and comprehensively tested. Clinical decision support must be explainable — explicit factor weights with deterministic output satisfy this.

**Two-tier alert system.** Cron-based `alert-rules.ts` detects multi-visit trends (3 consecutive elevated BPs). Synchronous `vital-thresholds.ts` fires immediately on vital save for single-reading emergencies (ACOG severe hypertension ≥160/110 requires evaluation within 15–30 min — a cron job is clinically unacceptable for this).

**URL-driven cohort state.** Population cohort filters live entirely in URL search params — cohorts are bookmarkable, shareable, and work without client-side state management. The server component reads params and builds the Prisma WHERE clause directly.

**FHIR R4 for interoperability.** 21st Century Cures Act mandates FHIR API access for certified EHRs. Three endpoints implement the standard with LOINC codes and US Core profiles, making MaternaTrack interoperable with Epic, Cerner, and Apple Health.

---

## Features

### Provider Dashboard
- **Morning Briefing** — AI-generated daily overview of the panel: urgent alerts, patients needing contact, upcoming appointments
- **AI Daily Worklist** — Streaming AI triage: which patients to prioritize today and why
- **Rising Risk Banner** — Automatically surfaces patients whose risk score trajectory is escalating (linear regression over last 6 data points)
- **Stats cards** — Total patients, high/very-high risk count, overdue tasks, patients not contacted in 14+ days
- **Patient list** — Filter by risk level, status; sort by risk score / last contact / name; live search
- **Keyboard navigation** — `j/k` to move through patient list, `Enter` to open, `/` to focus search, `1-5` to switch tabs, `?` for shortcut help
- **Responsive sidebar** — Collapsible to icon-only below 1280px; hamburger sheet below 1024px
- **Dark mode** — System preference detection + manual toggle; optimized for night shifts and NICU environments

### Patient Detail (6 Tabs)
- **Overview** — Risk score badge, factor breakdown radar, vitals trend charts (BP, glucose, weight), risk trajectory indicator (↑/→/↓), persistent AI Clinical Summary with staleness detection, care team section
- **Timeline** — Chronological event feed with escalation events highlighted in red
- **Care Plan** — Active protocol tasks by status (overdue/upcoming/pending), AI care gap analysis, activate/deactivate protocols, snooze tasks with reason
- **Messages** — Full conversation thread, send message, message templates, AI-assisted drafting
- **Visit Notes** — Structured SOAP notes with AI-assisted drafting
- **Baby** — Neonatal tracking (postpartum patients): birth details, weight gain chart, NICU timeline, feeding log

### AI Features (all streaming via SSE)
- **Clinical Summary** — Evidence-based 3-5 sentence summary referencing actual data points; cached with staleness detection
- **Care Gap Analysis** — Overdue screenings/tasks with ACOG/USPSTF/SMFM citations and urgency levels (routine/soon/urgent)
- **Message Draft** — Patient-facing outreach at 6th-grade reading level with template substitution
- **Panel Intelligence** — Aggregate panel health report with urgent action highlights
- **Visit Note Draft** — Structured SOAP note pre-populated from recent vitals, screenings, and timeline
- **AI Clinical Copilot** — Floating chat panel on patient detail; RAG over full patient record. Ask: *"Is she at risk for preeclampsia?"*, *"When was her last depression screening?"*, *"Summarize the last 2 weeks of vitals"*
- Rate limited: 20 req/min per provider; graceful fallback if AI unavailable

### Real-Time Vital Escalation
Critical thresholds fire **immediately** when a vital is recorded — not on the next cron cycle:

| Threshold | Guideline | Severity |
|-----------|-----------|----------|
| BP ≥ 160 systolic | ACOG: Hypertension in Pregnancy (2019) | CRITICAL |
| BP ≥ 110 diastolic | ACOG: requires eval within 15-30 min | CRITICAL |
| BP ≥ 140/90 | ACOG: hypertensive threshold | ELEVATED |
| Glucose ≥ 300 mg/dL | ADA: critical hyperglycemia | CRITICAL |
| SpO₂ ≤ 94% | Standard: hypoxia alert | CRITICAL |
| Fetal kicks < 10 in 2h | ACOG: "count to 10" method | ELEVATED |

Each threshold crossing creates an URGENT CareTask (due immediately), fires a notification, and creates a red escalation TimelineEvent. 4-hour cooldown per patient prevents duplicate alerts on rapid re-entry.

### Risk Engine
- Scoring across 4 domains: Demographic & History (25 pts), Clinical (35 pts), Engagement & Adherence (20 pts), Social Determinants (20 pts)
- Score → level: LOW (0-25) · MODERATE (26-50) · HIGH (51-75) · VERY_HIGH (76-100)
- Recalculated on every patient update; full history tracked for trend analysis
- **Predictive Risk** — Linear regression on last 6 risk score data points detects trajectories: "rising_risk" (projected to cross HIGH threshold in 14 days) or "critical_trajectory" (projected to cross VERY_HIGH in 7 days)

### Protocol Automation
- 4 protocol templates: Standard Prenatal, Preeclampsia Prevention, GDM Management, Perinatal Depression
- Task auto-generation with clinically appropriate due dates
- **Auto-trigger rules** — Protocols activate automatically based on clinical thresholds:
  - PHQ-9 ≥ 15 → Perinatal Depression protocol
  - GDM screen positive → GDM Management protocol
  - 3 consecutive elevated BPs → Preeclampsia Prevention protocol

### Compliance Reporting
ACOG, USPSTF, and SMFM guideline adherence measured automatically from existing clinical data:
- First prenatal visit by 10 weeks (ACOG)
- GDM screen at 24-28 weeks (ACOG)
- Group B strep screen at 36-37 weeks (ACOG)
- PHQ-9 depression screening per trimester (USPSTF)
- Preeclampsia risk assessment at first visit (SMFM)
- Low-dose aspirin by 16 weeks for high-risk patients (SMFM)

Interactive dashboard: per-guideline pass/fail rates with circular progress rings, guideline-source filter tabs (ACOG/USPSTF/SMFM), non-compliant patient detail sheet with search and avatar list.

### Analytics
- Risk distribution histogram
- Task status donut chart
- Protocol adoption bar chart
- Engagement quality metrics
- Priority patients table (high/very-high risk with overdue tasks)
- **Delivery Outcomes** — Delivery type donut (vaginal/C-section/VBAC), benchmark comparisons vs CDC national averages (C-section rate, preterm rate, NICU admission rate, low birth weight rate), postpartum depression screening rate, 6-month trend chart
- **Appointment Adherence** — Panel adherence rate, no-show breakdown by appointment type, top patients with most missed appointments

### Population Cohort Builder (`/dashboard/cohorts`)
Build arbitrary patient cohorts with URL-driven filters (bookmarkable, shareable):
- Risk level (multi-select: LOW/MODERATE/HIGH/VERY_HIGH)
- Patient status (PREGNANT/POSTPARTUM/PRECONCEPTION/INACTIVE)
- Last contact: more than 7/14/30 days ago, or never
- Missing screenings: PHQ-9 / GDM / SDOH in last 90 days
- Due date: within next 14/30/60 days
- Overdue tasks: checkbox
- SDOH flags: housing instability, food insecurity, transportation, IPV
- Export matching cohort as CSV

### No-Show Intelligence
- Marking an appointment as `no_show` automatically creates a high-priority follow-up CareTask (due next day) and fires a `no_show_followup` notification
- Appointment calendar shows ⚠ amber badge on patients with 2+ historical no-shows
- Adherence analytics section in dashboard

### Provider Handoffs
- Create structured handoff documents when reassigning patients: select receiving provider, auto-populate from patient data (open tasks, recent notes, risk summary), editable free-text
- Incoming handoffs shown as a banner on the dashboard for the receiving provider
- Full handoff history in patient timeline

### Notifications (Real-Time)
- SSE push — new notifications arrive without polling
- Notification bell with unread badge (99+ cap)
- Per-item dismiss with optimistic UI update
- Read notifications hidden by default, expandable with toggle
- Notification types: new messages, risk escalations, critical vital alerts, appointment reminders, care gaps, overdue tasks, no-show follow-ups

### FHIR R4 API
21st Century Cures Act-compliant endpoints with LOINC codes and US Core profiles:

```
GET /api/fhir/Patient/{id}               → FHIR R4 Patient resource
GET /api/fhir/Patient/{id}/Observation   → FHIR R4 Observation Bundle (all vitals)
GET /api/fhir/Patient/{id}/$everything   → FHIR R4 collection Bundle (Patient + Observations + Conditions + CarePlans)
```

- Content-Type: `application/fhir+json`
- Auth-protected (same session) + provider-isolated
- Vital → LOINC mappings: BP (85354-9), weight (29463-7), glucose (15074-8), heart rate (8867-4), SpO₂ (59408-5)
- Risk factors → FHIR Condition resources; care plans → FHIR CarePlan resources
- FHIR export link in patient detail header

### Patient Portal (`/portal`)
Separate authentication (cookie: `portal.session-token`). Patients can:
- View their own risk summary and care plan progress
- Message their care team (read + send)
- View and log vitals
- See upcoming appointments + request reschedule/cancellation
- Confirm appointments

### Provider Handoff & Team Care
- **Care Team** — Assign multiple providers to a patient (primary/consulting/covering roles); all team members can view shared patients
- **Multi-Provider Sharing** — "Link Existing Patient" for cross-panel sharing via `PatientAccess` join table; all patient queries automatically include shared access
- **Handoff Documents** — Structured provider-to-provider handoffs with open concerns, pending tasks, and AI-generated summary

### Onboarding Wizard
First-login multi-step wizard: Welcome → Create first patient → Activate a protocol → View AI features → Done. Skipped automatically after first completion.

### Message Templates
Pre-built templates with `{{firstName}}`, `{{nextAppointment}}` variable substitution:
- Missed appointment follow-up
- Screening reminder (PHQ-9, GDM, etc.)
- Lab results ready
- Appointment confirmation
- Check-in (no contact > 7 days)

### PDF Patient Summary
One-page clinical summary for referrals: demographics, risk profile, active protocols, recent vitals table, screening history, timeline highlights. Download from patient detail header or export button.

### Appointment Management
- Calendar view of all appointments
- Schedule appointments with conflict detection
- **Recurring appointments** — weekly/biweekly/monthly recurrence with count or end-date; cancel single or entire series
- Appointment types: initial intake, routine prenatal, follow-up, urgent, postpartum

### Admin Features (admin role only)
- **User management** — Create/deactivate providers, assign roles
- **Audit log** — Full audit trail with date range filter, resource type filter, actor filter, CSV export, pagination
- **Provider performance** — Panel size, average risk score, task completion rate, message response time, no-show rate, guideline adherence — comparison charts across providers

---

## Running Tests

### Unit tests (Vitest)
```bash
npm test
# 46 tests covering risk engine edge cases and clinical archetypes
```

### E2E tests (Playwright)
Requires a running dev server and seeded database:
```bash
npm run dev          # in one terminal
npm run test:e2e     # in another terminal
```

Test coverage:
- Auth flow: redirect unauthenticated, login, invalid credentials, successful login, sign out
- Dashboard: patient list, stats cards, sidebar navigation, search filter, analytics
- Patient detail: all tabs visible, overview content, care plan, messages, send message, back navigation

### CI/CD
GitHub Actions runs on every push to `main` and every PR:
1. `npm run lint` — ESLint
2. `tsc --noEmit` — TypeScript type check
3. `npm test` — Vitest unit tests
4. `npm run build` — Next.js production build
5. Playwright E2E (separate job, Docker Compose PostgreSQL)

---

## Database Commands

| Command               | Description                         |
|-----------------------|-------------------------------------|
| `npm run db:migrate`  | Run pending migrations              |
| `npm run db:seed`     | Seed 50 patients + providers        |
| `npm run db:reset`    | Reset DB + reseed from scratch      |
| `npm run db:studio`   | Open Prisma Studio (visual browser) |

After schema changes:
```bash
npx prisma migrate dev --name <migration-name>
npx prisma generate
```

> **Prisma 7 note:** The database URL is configured in `prisma.config.ts` for CLI operations. The client requires `@prisma/adapter-pg`. Import types from `@/generated/prisma/client`.

---

## Seed Data

50 patients built around 5 clinical archetypes, each with vitals history, screenings, care tasks, messages, appointments, and timeline events:

| Archetype   | Profile                                                        | Risk Level     |
|-------------|----------------------------------------------------------------|----------------|
| **Sarah**   | 32w, age 38, BP trending upward, preeclampsia protocol active  | HIGH (~72)     |
| **Maria**   | 28w, GDM diagnosed, improving glucose, high engagement         | MODERATE (~45) |
| **Aisha**   | 24w, disengaged, prior preterm, PHQ-9=14, SDOH barriers        | VERY HIGH (~78)|
| **Jennifer**| 16w, second pregnancy, all screenings current, low risk        | LOW (~12)      |
| **Keiko**   | 3w postpartum, NICU baby (born 34w) now home, PHQ-9 due        | HIGH (~55)     |

Postpartum patients (Keiko and variants) include `Baby` records with birth weight, gestational age at birth, APGAR scores, delivery type, NICU duration, and feeding type.

---

## Design Decisions

**Why Groq as default AI?** Groq's free tier provides LLaMA 3.3 70B at no cost during development. The abstraction layer makes it trivial to switch to Anthropic Claude for production with a single env var change.

**Why Server Actions over API routes for mutations?** Server Actions provide end-to-end type safety, automatic CSRF protection, and co-location with the components that use them — without separate route handlers or fetch calls.

**Why SSE over WebSockets?** SSE is unidirectional (server → client), simpler in Next.js App Router, and sufficient for both AI streaming and notification push. WebSockets would add complexity without benefit.

**Why persist AI summaries?** Regenerating on every page load is expensive and inconsistent. Persistence gives providers a stable reference; a staleness badge appears when underlying data changes.

**Why pure function risk engine?** A pure function is trivially testable, cacheable, and auditable. Clinical decision support must be explainable — explicit factor weights with deterministic output satisfy this requirement.

**Why real-time vital thresholds in addition to cron alerts?** ACOG requires urgent evaluation of severe-range hypertension (≥160/110) within 15–30 minutes. A cron job that runs hourly is clinically unacceptable. Synchronous threshold evaluation on vital save closes this gap.

**Why FHIR R4?** The 21st Century Cures Act mandates FHIR API access for certified EHR systems. A proper FHIR endpoint makes MaternaTrack interoperable with Epic, Cerner, Athena, Apple Health, and any SMART on FHIR app — the difference between a point solution and a healthcare platform.

**Why URL-driven cohort state?** Cohort URLs are shareable, bookmarkable, and require no client-side state. A provider can send a colleague a link to "all high-risk patients with no contact in 14 days" and they see the same filtered view.
