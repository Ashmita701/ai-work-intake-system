# AI-Assisted Work Intake System

A small operations application for receiving work items, running deterministic AI analysis, handling failures and retries, and completing reviewed work items.

## Setup

### Prerequisites

- Node.js (a current LTS release is recommended)
- npm
- PostgreSQL, running locally or otherwise reachable through `DATABASE_URL`

### Clone the repository

```bash
git clone https://github.com/Ashmita701/ai-work-intake-system.git
cd ai-work-intake-system
```

### Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Configure environment variables

Create local environment files from the included examples. The `.env` files are ignored by Git.

```bash
cd backend
copy .env.example .env

cd ../frontend
copy .env.example .env
```

On macOS/Linux, use `cp .env.example .env` instead of `copy`.

Backend variables:

- `DATABASE_URL`: PostgreSQL connection string used by Prisma.
- `PORT`: NestJS listen port; defaults to `3000`.
- `FRONTEND_ORIGIN`: CORS origin; defaults to `http://localhost:5173`.
- `MOCK_AI_MODE`: local mock mode; defaults to `success`.

Frontend variable:

- `VITE_API_BASE_URL`: backend base URL; defaults to `http://localhost:3000`.

### Set up PostgreSQL and Prisma

After configuring `backend/.env` and ensuring PostgreSQL is available, generate the client and apply the committed migration:

```bash
cd backend
npm run prisma:generate
npx prisma migrate deploy
```

The migration creates the `WorkItem` table, the `WorkItemStatus` enum, and the unique `externalId` constraint.

Useful Prisma commands:

```bash
npm run prisma:generate
npm run prisma:format
npm run prisma:validate
```

### Run the applications

Start the backend in one terminal:

```bash
cd backend
npm run start:dev
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

The API defaults to `http://localhost:3000`; Vite normally serves the UI at `http://localhost:5173`.

## Architecture

```text
React + Vite frontend
        |
        | HTTP
        v
NestJS API
  ├─ WorkItemsController -> WorkItemsService -> Prisma/PostgreSQL
  ├─ WorkItemWorkflow (centralized status transitions)
  └─ AI_PROVIDER -> MockAiProvider
```

The React/Vite frontend lists, filters, and acts on work items. The NestJS API owns HTTP validation and delegates business rules to services. `WorkItemsService` coordinates persistence, workflow checks, and AI analysis; `WorkItemWorkflow` centralizes legal state transitions. The AI provider contract separates analysis orchestration from `MockAiProvider`, while Prisma provides database access to PostgreSQL.

This structure keeps controllers thin, keeps state rules in one place, and permits a future real AI provider without changing the analysis flow.

## Assumptions

- `externalId` uniquely identifies a work item.
- Duplicate submissions return the existing work item instead of creating a second record.
- New work items begin in `RECEIVED`.
- AI analysis is synchronous for this assessment.
- The AI provider is a deterministic mock rather than an external LLM.
- Only the defined workflow transitions are permitted.
- Completion is permitted only from `READY_FOR_REVIEW`.
- The status endpoint accepts only `COMPLETED`, then validates the actual transition against the item’s current status.
- Filtering is client-side because server-side filtering and pagination are outside the assessment scope.

## Technical Decisions

**AI provider abstraction.** `WorkItemsService` depends on the `AI_PROVIDER` contract rather than directly on `MockAiProvider`, making a real LLM provider replaceable without changing the service. The trade-off is a small extra abstraction in a compact application.

**Database-enforced duplicate protection.** `externalId` is unique in PostgreSQL, and the service handles Prisma's `P2002` error after attempting the insert. This remains safe under concurrent requests, at the cost of handling an expected database error path.

**Centralized workflow.** `WorkItemWorkflow` owns the transition map used by analysis, retry, and completion. This prevents duplicated state checks and makes the rules simpler to test and change, with the trade-off of a dedicated policy class.

## Production Considerations

These are intentional improvements outside this small assessment’s scope.

- **Authentication and authorization:** Authenticate users and API clients; add roles or permissions for analysing, retrying, and completing work items; avoid unrestricted work-item APIs.
- **Background processing:** Move synchronous AI calls to a durable queue with idempotent jobs, persisted job state, retry/backoff, and dead-letter handling.
- **Observability:** Add structured logs, request/correlation IDs, metrics for latency/failures/retries/queue depth/API errors, tracing where appropriate, and alerts for repeated provider or database failures.
- **Scalability:** Add pagination, server-side filtering, suitable indexes, horizontally scalable API workers, separate AI workers, connection pooling, and database capacity planning.
- **Security:** Use deployed secrets management, payload limits, rate limiting, secure CORS, HTTPS/TLS, and safeguards against unauthorized access or AI-endpoint abuse. Do not expose internal provider/database details to clients.
- **Database design:** Define production migration and rollback practices, operational indexes, status-transition audit history where needed, and retention/archival policies.
- **LLM reliability and cost:** Define real-provider timeouts/retries, structured-output validation, model/version control, token limits, cost monitoring, budgets, fallback policy, and prompt/version tracking. Keep a human review step for operational decisions.

## AI Usage

OpenAI Codex was used as an AI-assisted coding tool to implement and refine application code, compare the implementation with requirements, generate/refine tests, investigate build/runtime issues, review frontend/backend integration, and prepare documentation.

AI-generated code was treated as a proposal, not automatically trusted. The generated source was inspected against requirements, then verified with TypeScript/build checks, automated backend tests, manual API and frontend workflows, PostgreSQL/Prisma checks, duplicate handling, state transitions, and failure/retry behavior.

One generated path required investigation: during integration testing, `GET` and `POST /work-items` returned `404` although the controller/module source appeared correct. The running process, compiled output, Nest startup, and route registration were investigated rather than assumed correct. The startup/build/run path was corrected so Nest creates the application and listens exactly once; after a clean build generated `dist/main.js`, the API became available.

## API

All IDs are UUIDs. The global validation pipe rejects invalid bodies and unknown body properties with `400 Bad Request`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/work-items` | Create a work item or return an existing item for a duplicate `externalId`. |
| `GET` | `/work-items` | List all work items, newest first. |
| `GET` | `/work-items/:id` | Get one work item by UUID. |
| `POST` | `/work-items/:id/analyse` | Start analysis for a `RECEIVED` item. |
| `POST` | `/work-items/:id/retry` | Retry analysis for a `FAILED` item. |
| `PATCH` | `/work-items/:id/status` | Complete a `READY_FOR_REVIEW` item. |

### Create a work item

```json
{
  "externalId": "CRM-12345",
  "title": "Missing income document",
  "description": "The applicant submitted their application but has not provided their latest payslip."
}
```

`externalId`, `title`, and `description` must be non-empty strings. The server creates the UUID, assigns `RECEIVED`, and initializes AI fields as `null`.

A new item returns `201 Created` with:

```json
{ "workItem": { "...": "..." }, "created": true }
```

Duplicate submissions are safe under concurrency: the service attempts the insert, catches Prisma's unique-constraint error, and returns the existing item. A duplicate returns `200 OK` with `created: false`; no second item is created.

### Complete a reviewed item

`PATCH /work-items/:id/status` accepts only:

```json
{ "status": "COMPLETED" }
```

The workflow still validates the transition, so it succeeds only from `READY_FOR_REVIEW`.

## Workflow

```text
RECEIVED          -> ANALYSING
ANALYSING         -> READY_FOR_REVIEW
ANALYSING         -> FAILED
FAILED            -> ANALYSING
READY_FOR_REVIEW  -> COMPLETED
COMPLETED         -> (no outgoing transitions)
```

The analysis endpoint starts only from `RECEIVED`; retry starts only from `FAILED`; completion succeeds only from `READY_FOR_REVIEW`.

## AI Analysis and Retry Behavior

`AI_PROVIDER` accepts only a work item’s `title` and `description` and returns `category`, `priority`, `summary`, and `recommendedAction`. The application binds it to `MockAiProvider`, which makes no external API calls.

Provider output is validated before persistence: all four fields must be non-empty strings, and `priority` must be `LOW`, `MEDIUM`, or `HIGH`.

For local manual testing, set `MOCK_AI_MODE` in `backend/.env` to one of:

- `success` (or omit it): deterministic valid analysis.
- `failure`: provider throws.
- `malformed`: provider returns incomplete data.
- `unexpected`: provider returns an unexpected value.
- `timeout`: provider waits 11 seconds, exceeding the service’s 10-second timeout.

Successful analysis follows `RECEIVED -> ANALYSING -> READY_FOR_REVIEW`, saves the result, and clears `analysisError`. Provider failures, timeouts, malformed responses, and unexpected values do not save invalid fields; they follow `ANALYSING -> FAILED` and store `analysisError`. Retry clears the old error while entering `ANALYSING`, then either succeeds or saves the new error.

## Frontend Behavior

The operations UI fetches `GET /work-items`, filters the loaded list by status, and displays title, external ID, description, status, and available AI fields. It shows **Analyse** for `RECEIVED`, the persisted analysis failure reason and **Retry** for `FAILED`, and **Complete** for `READY_FOR_REVIEW`. It refreshes after successful actions and includes initial, per-item action, API-error, and empty states.

## Testing and Builds

Backend tests:

```bash
cd backend
npm test -- --runInBand
```

Backend build:

```bash
cd backend
npm run build
```

Frontend build:

```bash
cd frontend
npm run build
```

## Manual API Testing (PowerShell)

With PostgreSQL, the migration, and backend running, create a work item:

```powershell
$item = Invoke-RestMethod -Method Post -Uri http://localhost:3000/work-items `
  -ContentType 'application/json' `
  -Body '{"externalId":"CRM-12345","title":"Missing income document","description":"The applicant submitted their application but has not provided their latest payslip."}'

$item.workItem
```

Run analysis, then complete the item:

```powershell
$id = $item.workItem.id

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/work-items/$id/analyse"

Invoke-RestMethod -Method Patch -Uri "http://localhost:3000/work-items/$id/status" `
  -ContentType 'application/json' `
  -Body '{"status":"COMPLETED"}'
```

Retrieve the list:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/work-items
```

### Manual concurrent duplicate test

This sends two concurrent create requests with the same `externalId`:

```powershell
$externalId = "CRM-CONCURRENT-$(Get-Date -Format 'yyyyMMddHHmmssfff')"
$body = @{
  externalId = $externalId
  title = 'Concurrent duplicate test'
  description = 'Verifies concurrent duplicate handling.'
} | ConvertTo-Json

$jobs = 1..2 | ForEach-Object {
  Start-Job -ScriptBlock {
    param($requestBody)
    Invoke-RestMethod -Method Post -Uri http://localhost:3000/work-items `
      -ContentType 'application/json' -Body $requestBody
  } -ArgumentList $body
}

$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

$results | ForEach-Object {
  [pscustomobject]@{ created = $_.created; id = $_.workItem.id }
}

(Invoke-RestMethod -Uri http://localhost:3000/work-items) |
  Where-Object externalId -eq $externalId
```

Expect one response with `created: true`, one with `created: false`, and the same work-item ID in both responses. The final query should show one record for the `externalId`; PostgreSQL’s unique constraint and Prisma `P2002` handling protect this concurrent case.

## Assessment Scope and Limitations

- The AI provider is deliberately a deterministic mock; no real LLM integration is included.
- There is no authentication, authorization, background processing, routing library, or UI framework.
- Filtering is client-side and limited to status.
- The API has no pagination, search, or general work-item update endpoint.
- The only client-exposed status update is completion of an item already ready for review.
