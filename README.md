# Fashinza — B2B Fashion Manufacturing Platform (MVP)

Fashinza connects fashion brands with clothing manufacturers: brands submit production requirements, compatible
manufacturers send quotations, and both sides track production milestones and quality control.

> **Build status:** Stage 1 (foundation) and Stage 2 (public website) are complete.
> Authentication, dashboards and the production workflow are added in the next stages.

## Tech stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 with shadcn/ui-style components (Radix primitives) and Lucide icons
- PostgreSQL + Prisma 7 (`@prisma/adapter-pg` driver adapter)
- Zod for validation (shared by the browser and the server)
- Vitest (unit tests) and Playwright (end-to-end tests)

## Prerequisites

- Node.js 20.19 or newer (22 recommended)
- PostgreSQL 14 or newer

## Setup

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # then edit DATABASE_URL
npm run db:migrate          # creates all tables
npm run dev                 # http://localhost:3000
```

Create the database first, for example:

```sql
CREATE USER fashinza WITH PASSWORD 'choose-a-password' CREATEDB;
CREATE DATABASE fashinza OWNER fashinza;
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | Email shown on the contact page and footer (defaults to a placeholder) |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build / start |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check |
| `npm test` | Unit tests (Vitest) |
| `npm run db:migrate` | Create and apply migrations in development |
| `npm run db:deploy` | Apply migrations in production |

## Project structure

```
prisma/schema.prisma        Database models (users, profiles, projects, quotations, orders, milestones, QC, notifications, admin)
prisma/migrations/          SQL migrations
src/app/(public)/           Public website pages
src/app/(auth)/             Login and registration
src/components/ui/          Design-system components
src/components/site/        Header, footer and marketing sections
src/lib/                    Database client, validation schemas, rate limiter, constants
tests/unit/                 Unit tests
```

## Implemented so far

- Design system: brand colours, Inter typography, buttons, inputs, cards, badges, alerts, mobile menu.
- Database schema and initial migration for every MVP model.
- Public pages: Home, How It Works, For Brands, For Manufacturers, About, Contact, Login, Register, 404.
- Contact form with browser and server validation, rate limiting (5 per 10 minutes per IP) and database storage.
- Register and login forms with full validation (account creation is connected in Stage 3).

## Known limitations

- The rate limiter is in memory; use a shared store such as Redis when running more than one server instance.
- Deferred features (AI matching, trend forecasting, chat, payments, mobile apps) are not part of the MVP.
