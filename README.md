# mycscompanion

Learn computer science by building real systems in Go.

## Setup

### Prerequisites

- Node.js >= 20 (see `.nvmrc`)
- pnpm 10.x (managed via Corepack: `corepack enable`)
- Docker and Docker Compose

### Getting Started

```bash
# Clone the repository
git clone <repo-url> mycscompanion
cd mycscompanion

# Install dependencies
pnpm install

# Start local infrastructure (PostgreSQL 16 + Redis 7)
docker compose up -d

# Start all apps concurrently (backend, webapp, website)
pnpm dev
```

### CI

CI uses `pnpm install --frozen-lockfile` — never bare `pnpm install`.

## Workspace Structure

| Workspace | Description |
|---|---|
| `apps/backend` | Fastify API + BullMQ worker |
| `apps/webapp` | React SPA (Vite + SWC) |
| `apps/website` | Astro static landing page |
| `packages/config` | Shared ESLint, TS, Vitest, Tailwind config |
| `packages/shared` | Shared types, constants, utilities |
| `packages/ui` | shadcn/ui + Tailwind CSS v4 components |
| `packages/execution` | Fly Machine config, SSE event types |
