# Workspace

## Overview

Project Anamnesis — pnpm workspace monorepo using TypeScript. A therapy session intelligence platform with biometric correlation, outcome-based therapist matchmaking, and AI-assisted clinical brief generation.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)

## Artifacts

- **api-server** (`artifacts/api-server/`) — Express 5 REST API at `/api`
- **web-app** (`artifacts/web-app/`) — React + Vite + Tailwind; on branch **`vr-experience`** the app is **VR-only** (therapy room at `/`, `/vr`, `/vr/:sessionId`).
- **mockup-sandbox** (`artifacts/mockup-sandbox/`) — design sandbox at `/__mockup`

## Frontend (web-app) — `vr-experience` branch

- **Routes**: `/`, `/vr`, `/vr/:sessionId` — WebXR therapy room only (no API client in this build).
- **Theme**: scene uses its own dark palette; global CSS kept for Tailwind.

## OpenAPI Endpoints

- `GET /api/sessions` — list all sessions (most recent first)
- `POST /api/sessions` — create intake session
- `PATCH /api/sessions/:id/end` — end a session
- `POST /api/sessions/:id/biometrics` — add HR/HRV readings
- `GET /api/sessions/:id/biometrics` — get all biometric readings for a session

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/api-server run seed` — seed DB with 3 mock therapists and 1 patient

## Database Schema

- `intake_sessions` — therapy session records (id, label, startedAt, endedAt)
- `biometric_readings` — HR/HRV readings linked to sessions (id, sessionId, metric, value, recordedAt)
- `therapists` — therapist profiles with outcome data JSON (id, name, specialties[], outcomeData)
- `patients` — patient records with demographics JSON (id, name, demographics)

## API Endpoints

### Health
- `GET /api/healthz` — health check

### Sessions
- `POST /api/sessions` — create a new intake session
- `PATCH /api/sessions/:sessionId/end` — end a session
- `GET /api/sessions/:sessionId/brief` — get SOAP clinical brief (objective biometrics; AI content added in Task 4)

### Biometrics
- `POST /api/sessions/:sessionId/biometrics` — ingest batch of HR/HRV readings
- `GET /api/sessions/:sessionId/biometrics` — retrieve readings ordered by time

### Therapists
- `GET /api/therapists` — list all therapists
- `GET /api/therapists/:id` — get therapist with outcome data

### Matchmaking
- `POST /api/match` — accepts `{ clinicalProfile: string }`, returns best-matched therapist by outcome success rate

## Key Utilities

- `artifacts/api-server/src/lib/biometricCorrelation.ts` — maps biometric readings to transcript segments by timestamp proximity, flags HR spikes ≥15% above baseline as "biometric subtext" events

## VR Experience (`vr-experience` branch)

- **Route**: `/vr` (or `/vr/:sessionId` to bind to an existing intake session).
- **Runtime**: WebXR via React Three Fiber. Open the URL in the **Meta Quest
  Pro browser** and tap **Enter VR**. WebXR requires HTTPS; the Replit dev
  tunnel provides this automatically.
- **Desktop preview**: the same URL in Chrome renders an orbit-camera preview
  of the scene, so you can iterate on art/code without the headset.
- **Assets**: drop `avatar.glb` and `therapy-room.glb` into
  `artifacts/web-app/public/models/`. Until then the scene falls back to
  procedural geometry defined in `src/vr/FallbackRoom.tsx` and
  `src/vr/FallbackAvatar.tsx`. See `public/models/README.md` for asset sources
  (Ready Player Me for the avatar, Poly Haven for the room).
- **Voice pipeline**: not wired yet. `Avatar.speak()` is a documented no-op
  seam for a future STT→Claude→TTS+viseme pipeline.

## Workspace Packages

| Package | Location | Purpose |
|---|---|---|
| `@workspace/db` | `lib/db` | Drizzle ORM schema + db client |
| `@workspace/api-zod` | `lib/api-zod` | Zod schemas + TS types (generated from OpenAPI) |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI spec + Orval codegen config |
| `@workspace/api-client-react` | `lib/api-client-react` | React Query hooks (generated) |
| `api-server` | `artifacts/api-server` | Express backend service |
| `mockup-sandbox` | `artifacts/mockup-sandbox` | Frontend UI sandbox |
| `ios-relay` | `artifacts/ios-relay` | iOS/WatchOS integration |

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
