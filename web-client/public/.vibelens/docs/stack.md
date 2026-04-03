<!-- vibelens format:1 -->

# Technology Stack

## Frontend

| Technology            | Version         | Purpose                                                                          |
| --------------------- | --------------- | -------------------------------------------------------------------------------- |
| Next.js               | 15.5.14         | React framework with App Router, file-based routing, server/client components    |
| React                 | 19.x            | UI library                                                                       |
| TypeScript            | 5.x             | Type safety across all frontend code                                             |
| TanStack Query        | 5.95.2          | Server state management -- data fetching, caching, mutations, optimistic updates |
| TanStack Virtual      | 3.x             | Virtualized message list rendering (`@tanstack/react-virtual`)                   |
| react-markdown        | 9.x             | Markdown rendering for agent text responses with citation support                |
| SCSS Modules          | via sass 1.86.0 | Component-scoped styling with CSS custom properties                              |
| Vercel Analytics      | 1.x             | Frontend performance and usage analytics                                         |
| Vercel Speed Insights | 2.x             | Core Web Vitals monitoring                                                       |
| VibeLens              | 2.1.3           | Interactive documentation dock bar                                               |

## Backend

| Technology         | Version | Purpose                                     |
| ------------------ | ------- | ------------------------------------------- |
| Express            | 5.2.1   | HTTP API framework                          |
| TypeScript         | 5.9.3   | Type safety across all server code          |
| Anthropic SDK      | 0.80.0  | Claude API client for agentic tool-use loop |
| ioredis            | 5.10.1  | Redis client for API response caching       |
| pg                 | 8.18.0  | PostgreSQL client (raw SQL, no ORM)         |
| Zod                | 4.3.6   | Request body validation schemas             |
| bcrypt             | 6.0.0   | Password hashing (12 salt rounds)           |
| Pino               | 10.3.1  | Structured JSON logging                     |
| Helmet             | 8.1.0   | Security HTTP headers                       |
| express-rate-limit | 8.2.1   | Rate limiting middleware                    |
| cookie-parser      | 1.4.7   | Session cookie parsing                      |
| node-pg-migrate    | 8.0.4   | Database migration runner                   |

## Shared Packages

| Package                              | Purpose                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `@agentic-travel-agent/shared-types` | `ChatNode` discriminated union, tile data interfaces, `SSEEvent` types -- imported by both server and frontend |

## Infrastructure

| Service               | Provider                | Purpose                                                                |
| --------------------- | ----------------------- | ---------------------------------------------------------------------- |
| Frontend hosting      | Vercel                  | Next.js deployment, domain `interviewiangreenough.xyz`                 |
| API hosting           | Railway                 | Dockerized Express server                                              |
| Database              | Neon                    | Managed PostgreSQL                                                     |
| Cache                 | Railway                 | Redis instance for SerpApi/Google Places response caching              |
| AI                    | Anthropic Claude        | `claude-sonnet-4-20250514` model for agentic tool-use                  |
| Flight/Hotel/Car data | SerpApi                 | Google Flights, Google Hotels, Google Car Rental (250/month free tier) |
| Experience data       | Google Places API       | Text Search for activities, restaurants, tours                         |
| Travel advisories     | US State Dept + UK FCDO | Auto-enrichment travel advisory data                                   |
| Weather               | Open-Meteo              | Free 7-day weather forecast API (no key required)                      |

## Development Tools

| Tool       | Purpose                                                           |
| ---------- | ----------------------------------------------------------------- |
| pnpm       | Package manager with workspace support                            |
| Vitest     | Unit and integration testing                                      |
| Playwright | End-to-end testing                                                |
| Supertest  | HTTP integration testing                                          |
| ESLint 9   | Linting with jsx-a11y, security, unused-imports plugins           |
| Prettier   | Code formatting (4-space indent, trailing commas, 100 char width) |
| Lefthook   | Git hooks for pre-commit/pre-push checks                          |
| tsx        | TypeScript execution for development                              |
| tsc-alias  | Path alias resolution in compiled output                          |

## Monorepo Structure

The project uses **pnpm workspaces** with three packages:

- `packages/shared-types/` -- Shared TypeScript types (package: `@agentic-travel-agent/shared-types`)
- `server/` -- Express API (package: `agentic-travel-agent-server`)
- `web-client/` -- Next.js frontend (package: `agentic-travel-agent-web`)

The monorepo root contains shared configs (ESLint, Prettier, TypeScript), the Dockerfile for Railway, and orchestration scripts.

## Key Environment Variables

| Variable                | Used By  | Purpose                                      |
| ----------------------- | -------- | -------------------------------------------- |
| `DATABASE_URL`          | Server   | Neon PostgreSQL connection string            |
| `REDIS_URL`             | Server   | Railway Redis connection string              |
| `ANTHROPIC_API_KEY`     | Server   | Claude API authentication                    |
| `SERPAPI_API_KEY`       | Server   | SerpApi flight, hotel, and car rental search |
| `GOOGLE_PLACES_API_KEY` | Server   | Google Places Text Search API                |
| `CORS_ORIGIN`           | Server   | Comma-separated allowed frontend origins     |
| `PORT`                  | Server   | HTTP port (default 3000 in production)       |
| `NODE_ENV`              | Both     | Environment flag (production/development)    |
| `NEXT_PUBLIC_API_URL`   | Frontend | Backend API base URL                         |
