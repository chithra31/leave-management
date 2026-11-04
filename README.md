# Leave Management with Balance and Overlap Rules

Employees request leave, managers approve or reject it, and balances are tracked per leave type.
A request must respect the employee's remaining balance, their own existing requests, and team coverage.

- **Frontend:** Angular 22 (standalone components, signals)
- **Backend:** NestJS 12 + TypeORM
- **Database:** PostgreSQL 17
- **Tests:** Vitest (47 automated tests)

## Contents

1. [Features](#features)
2. [Setup](#setup)
3. [Running the tests](#running-the-tests)
4. [Architecture](#architecture)
5. [Data model](#data-model)
6. [Business rules and design decisions](#business-rules-and-design-decisions)
7. [API](#api)
8. [Extras](#extras)
9. [Known limitations](#known-limitations)

## Features

- Three roles (employee, manager, admin), **enforced on the server**.
- Leave types (Annual, Sick, Unpaid), each with a yearly allowance.
- Request form with leave type, start date, end date and reason. Weekends and public holidays are not counted.
- **Balance rule:** a request cannot exceed the remaining balance, and pending requests count against it.
- **Overlap rules:** no overlapping requests for one employee, and a cap on how many team members can be off on the same day.
- Approval workflow: pending, approved, rejected, cancelled. Cancelling returns the days.
- Team calendar and a per-employee balance chart.
- Admin-configurable values that change behaviour with no code change: yearly allowance per type, minimum notice days, max team members off per day, and public holidays.
- Seed data: 2 managers, 8 employees, 1 admin, 3 leave types, 7 public holidays, 40 requests in mixed states.
- Extras: email notifications and an AI availability summary (see [Extras](#extras)).

## Setup

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 22 LTS or newer (20.11+ minimum) |
| PostgreSQL | 15 or newer (17 tested) |
| Git | any recent version |

Optional: [Mailpit](https://mailpit.axllent.org) to see the notification emails.

### 1. Get the code and install dependencies

```bash
git clone <repo-url> leave-management
cd leave-management
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Create the database

Either use a local PostgreSQL install:

```bash
psql -U postgres -c "CREATE DATABASE leave_mgmt;"
```

or start PostgreSQL (and Mailpit) with Docker, which creates the database for you:

```bash
docker compose up -d
```

### 3. Configure the backend

```bash
cd backend
cp .env.example .env        # on Windows PowerShell: Copy-Item .env.example .env
```

Edit `backend/.env` and set `DB_PASS` to your PostgreSQL password. The Docker setup uses user `postgres` and password `postgres`.

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | PostgreSQL connection |
| `JWT_SECRET` | Signs login tokens. Change it for any shared environment. |
| `PORT` | API port (default 3000) |
| `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` | Email. Leave `SMTP_HOST` empty to turn email off. |
| `AI_API_KEY`, `AI_MODEL` | Optional. Without a key the summary uses a built-in fallback. |

### 4. Create the tables and seed data

```bash
cd backend
npm run seed
```

This builds the schema, then **wipes and refills** all tables, so only run it on a development database.
It prints the demo password at the end.

### 5. Start both apps

In two terminals:

```bash
cd backend && npm run start:dev      # API on http://localhost:3000
```

```bash
cd frontend && npm start             # app on http://localhost:4200
```

Open http://localhost:4200 and sign in.

### Demo accounts

All seeded users share the password `Password123!`.

| Role | Email | Notes |
|---|---|---|
| Employee | `liam@company.test` | Also `olivia`, `noah`, `emma` (Maria's team); `ava`, `lucas`, `mia`, `ethan` (James's team) |
| Manager | `maria@company.test` | Manages Liam, Olivia, Noah, Emma |
| Manager | `james@company.test` | Manages Ava, Lucas, Mia, Ethan |
| Admin | `admin@company.test` | Settings only |

(All emails end in `@company.test`.)

## Running the tests

```bash
cd backend
npm test
```

47 unit tests cover:

- Working-day counting: weekends, holidays, a holiday on a weekend, single-day ranges.
- Date validation: end before start, ranges spanning two years, ranges with no working days.
- Minimum notice, including changing the configured value.
- Balance: exceeding it, using it exactly, pending counting against it, **cancelling restoring it**, a changed allowance.
- Self-overlap and team coverage: boundary days, pending and cancelled teammates, a changed cap.
- Email templates, and that a mail failure never throws.
- Availability summary text, and that the leave reason is never sent to the AI.

### End-to-end smoke test (needs the API running)

`backend/scripts/smoke.sh` calls the real API and checks the server-side role rules, overlap, cancel-restores-balance, and that changing a setting changes behaviour:

```bash
cd backend
npm run seed
API=http://localhost:3000 bash scripts/smoke.sh
```

Every line should end in `OK`. The script leaves a few test requests behind, so run `npm run seed` again before re-running it or before a demo.

## Architecture

```
frontend/ (Angular, :4200)  --HTTP/JSON + JWT-->  backend/ (NestJS, :3000)  --TypeORM-->  PostgreSQL
                                                          |
                                                          +--> SMTP (Mailpit)   +--> AI API (optional)
```

```
backend/src/
  auth/            JWT login, global login guard, global role guard, @Roles / @Public decorators
  leave/
    date.utils.ts  UTC date maths and working-day counting
    rules.ts       pure rule functions (balance, overlap, coverage, notice, dates)
    leave.service.ts   applies the rules inside a DB transaction; approve, reject, cancel, calendar
    leave.controller.ts
  settings/        admin-configurable rules, read from the database on every request
  admin/           config, leave type and holiday endpoints (admin only)
  notifications/   email templates and a sender that never throws
  summary/         availability summary: AI call with a built-in fallback
  entities/        TypeORM entities
  seed.ts          deterministic seed that builds requests with the same rule functions

frontend/src/app/
  core/            API client, auth state, token interceptor, route guard
  pages/           login, my-leave, approvals, team-calendar, admin
```

**Why the rules are pure functions.** The rule checks in `rules.ts` take plain data and throw HTTP errors. The service loads data and calls them. That makes the important logic easy to test without a database, and the seed reuses the same functions so seeded data is always valid.

**Security.** Every route requires a valid token unless marked `@Public()`. `@Roles()` is checked by a global guard on the server. The Angular route guards only hide screens a user could not use anyway.

## Data model

| Table | Columns | Notes |
|---|---|---|
| `users` | id, name, email (unique), passwordHash, role, managerId | `managerId` points to another user. **A team is everyone with the same manager.** |
| `leave_types` | id, name (unique), yearlyAllowance | |
| `public_holidays` | id, date (unique), name | Excluded from day counts. |
| `leave_requests` | id, employeeId, leaveTypeId, startDate, endDate, days, reason, status, decidedById, decidedAt, createdAt | `days` is stored at request time. |
| `settings` | key, value | `minNoticeDays`, `maxTeamOffPerDay`. |

Request status: `pending`, `approved`, `rejected`, `cancelled`.

## Business rules and design decisions

1. **Balance is computed, not stored.** Remaining = yearly allowance minus the days of the employee's *pending and approved* requests of that type in that year. Rejected and cancelled requests do not count, so **cancelling restores the balance automatically** and there is no counter to drift out of sync.
2. **Working days only.** Weekends and public holidays are skipped. A request with zero working days is rejected.
3. **Team coverage counts pending requests too.** Otherwise two pending requests could both be approved past the cap. The cap applies per working day, counting each teammate once.
4. **Minimum notice** is measured in calendar days between today and the start date.
5. **One calendar year per request.** A request cannot span two years; submit one for each. This keeps the yearly balance unambiguous.
6. **Cancelling:** an employee (or admin) can cancel a pending request, or an approved one that has not started. Leave that has already started cannot be cancelled.
7. **Who decides:** only a manager, and only for their own reports. Admins configure but do not approve. Only employees create requests.
8. **Concurrency.** Creating a request runs in a transaction and locks the team's manager row, so two simultaneous requests are checked one at a time and cannot both pass.
9. **Configuration is read on every request**, so changing a setting or allowance applies immediately with no code change or restart.
10. **No half days.** Out of scope.

## API

All routes except login need `Authorization: Bearer <token>`.

| Method and path | Role | Purpose |
|---|---|---|
| `POST /auth/login` | public | Returns a token and the user |
| `GET /auth/me` | any | Current user |
| `POST /leave-requests` | employee | Create a request |
| `GET /leave-requests/mine` | employee | My requests |
| `GET /leave-requests/balance?year=` | employee | Balance per leave type |
| `GET /leave-requests/team?status=` | manager | My reports' requests |
| `PATCH /leave-requests/:id/approve` / `reject` | manager | Decide on a report's pending request |
| `PATCH /leave-requests/:id/cancel` | employee, admin | Cancel |
| `GET /leave-requests/calendar?from=&to=` | any | Leave in the caller's team |
| `GET /leave-requests/summary` | any | Plain-language availability, next 14 days |
| `GET /leave-types`, `GET /holidays` | any | Reference data |
| `GET` / `PUT /admin/config` | admin | Notice days, team cap |
| `POST` / `PATCH /admin/leave-types` | admin | Add or change a leave type and allowance |
| `POST` / `DELETE /admin/holidays` | admin | Manage public holidays |

Errors use standard codes: 400 invalid input, 401 not signed in, 403 wrong role, 409 balance or overlap conflict.

## Extras

**Email notifications.** The manager is emailed when a request is created or cancelled, and the employee when it is approved or rejected. To see them, run Mailpit (SMTP on 1025, inbox at http://localhost:8025) and keep `SMTP_HOST=localhost`. Email is a side effect: if it fails it is logged and ignored, and the request still succeeds.

**AI availability summary.** The calendar page shows a short plain-language summary of who is away over the next 14 days, flagging busy days and pending requests. With `AI_API_KEY` set it asks an Anthropic model; otherwise, or if the call fails, it uses a built-in text summary. Only names, dates and leave type are sent, never the reason.

## Known limitations

- The database schema is created by TypeORM `synchronize`, which is fine here but should be replaced by migrations in production.
- The login token is kept in browser local storage and lasts 8 hours; there is no refresh or password reset.
- The frontend has no automated tests; the automated tests cover the backend rules and services.
- The AI call has not been run against the live API in development, only its fallback and prompt building.
- `docker-compose.yml` has not been run in development (Docker was not installed on the dev machine).
