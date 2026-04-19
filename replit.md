# Anamnesis

## Overview

Anamnesis is a mental health intake platform that replaces traditional paper intake forms with AI-driven video conversations. Patients complete an intake interview with an AI avatar (Tavus), have their biometric data (HR/HRV) passively correlated, receive a generated SOAP clinical brief, and are matched to therapists based on outcome data.

## Architecture

pnpm monorepo with TypeScript throughout.

```
artifacts/
  api-server/        Express API (Node.js) - port 8080
  web-app/           React + Vite frontend - port assigned dynamically

lib/
  db/                Drizzle ORM + PostgreSQL schema
  api-spec/          OpenAPI 3.1 spec + orval codegen config
  api-zod/           Generated Zod validators (from spec)
  api-client-react/  Generated React Query hooks (from spec)
  integrations-anthropic-ai/  Anthropic SDK wrapper
```

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Database**: PostgreSQL via Replit (Drizzle ORM)
- **API**: Express 5, TypeScript, OpenAPI 3.1
- **AI**: OpenAI (via Replit AI Integrations) for SOAP note generation + profile inference
- **Video**: Tavus API for AI intake conversations (needs TAVUS_API_KEY secret)
- **Frontend**: React 19 + Vite + Tailwind CSS v4

## DB Schema

| Table | Purpose |
|---|---|
| therapists | 55 seeded clinicians with outcome data, specialties, availability |
| patients | Demo patient records |
| intake_sessions | Intake sessions linking to briefs + therapist assignments |
| biometric_readings | HR/HRV readings per session |
| conversations | Tavus conversation metadata |
| messages | Transcript messages per conversation |

## API Routes

| Route | Description |
|---|---|
| GET /api/healthz | Health check |
| GET /api/sessions | List all sessions |
| POST /api/sessions | Create session |
| PATCH /api/sessions/:id/end | End session + generate SOAP brief |
| GET /api/sessions/:id/brief | Get completed brief |
| POST /api/sessions/:id/biometrics | Add HR/HRV batch |
| GET /api/sessions/:id/biometrics | Get biometrics |
| GET /api/therapists | List all therapists |
| GET /api/therapists/:id | Get therapist |
| POST /api/therapists/match | Match therapist by clinical profile |
| POST /api/sessions/:id/tavus | Create Tavus conversation |
| DELETE /api/sessions/:id/tavus | End Tavus conversation |
| POST /api/sessions/:id/conversation | Create/get conversation record |
| POST /api/sessions/:id/conversation/messages | Add transcript message |

## Environment Variables

| Variable | Purpose |
|---|---|
| DATABASE_URL | PostgreSQL connection (set by Replit) |
| AI_INTEGRATIONS_OPENAI_API_KEY | OpenAI via Replit proxy (auto-provisioned) |
| AI_INTEGRATIONS_OPENAI_BASE_URL | OpenAI proxy base URL (auto-provisioned) |
| TAVUS_API_KEY | Tavus video API key (user-provided) |
| TAVUS_PERSONA_ID | Tavus persona ID (optional) |
| TAVUS_REPLICA_ID | Tavus replica ID (optional) |
| SESSION_SECRET | Cookie signing secret |
| DEMO_ACCOUNT_PASSWORD | Shared password used when provisioning demo Clerk accounts (default: `Anamnesis-Demo-2026`) |
| VITE_DEMO_ACCOUNT_PASSWORD | Same password, exposed to the web client so the `/demo` page can display it |

## Demo accounts

On boot the API server provisions one Clerk user per demo patient and roster therapist using deterministic emails (`first.last@anamnesis-demo.com`) and the shared `DEMO_ACCOUNT_PASSWORD`. The `clerkUserId` is written back onto each row so the link is permanent and idempotent across restarts. The `/demo` page in the web app lists every account with copy/sign-in helpers. Therapists with a real `seedEmail` (e.g. Dr. Zak Rahman) are skipped and keep their real-account flow.

## Running Locally

```bash
pnpm install
pnpm --filter @workspace/db run push  # push schema
pnpm --filter @workspace/api-server run dev  # start API
pnpm --filter @workspace/web-app run dev     # start frontend
```

## iOS + Apple Watch Companion App

A native Swift companion app lives at `ios/Anamnesis.xcodeproj`. Open it in Xcode 15+ to build.

- **iPhone app** (`ios/Anamnesis/`): SwiftUI screen to enter a Session ID and tap Start/Stop. Uses `WCSession` to receive HR/HRV samples from the Watch and POSTs them in batches via `BiometricAPIClient`.
- **WatchKit Extension** (`ios/AnamnesisWatch Extension/`): Starts an `HKWorkoutSession`, collects live HR and HRV via `HKLiveWorkoutBuilder`, and sends readings to the iPhone every 5 seconds via `WCSession.sendMessage`.
- **Config**: Edit `ios/Anamnesis/Config.plist` → `APIBaseURL` to point at the deployed API.
- **Auth**: `POST /api/sessions/:id/biometrics` is explicitly open — no cookie required — so the native app can upload without browser auth.

## Key Design Decisions

- OpenAI is accessed via Replit AI Integrations proxy — no user API key needed
- Biometric simulation runs server-side every 5s during active sessions (superseded by real Watch data when iOS app is connected)
- Therapist matching uses outcome data scoring: `successRate * log(caseCount + 1)` plus specialty match bonus
- SOAP notes generated by GPT-4o-mini with biometric context included
- Tavus integration optional — app works without it with a demo placeholder
