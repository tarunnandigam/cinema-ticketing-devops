# Cinema Ticketing Platform

Initial backend foundation for the ALGIONS AI LABS PRIVATE LIMITED DevOps & Cloud Engineering internship assessment.

## Current scope

This repository contains an Express 5 API with PostgreSQL readiness, a production-oriented Docker image, and a local Docker Compose stack. CI/CD, cloud infrastructure, and Terraform are not implemented.

## Requirements and run

Use Node.js 24 LTS and PostgreSQL 18. Create the `cinema_ticketing` database (for example with `createdb cinema_ticketing` or `psql`) using a local PostgreSQL account. Configure the connection through your local `.env` file:

```powershell
Copy-Item .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Set `DATABASE_URL` to the connection string for your PostgreSQL account. The example uses local passwordless authentication syntax and includes no password. If your server requires a password, supply it privately in `.env`; never commit that file. `.env` is ignored by Git. `npm start` starts production mode.

## Endpoints

- `GET /health`: process responds (200), independent of PostgreSQL
- `GET /ready`: runs `SELECT 1`; returns 200 when PostgreSQL is reachable or sanitized 503 otherwise
- `GET /api/v1`: API identity (200)
- `GET /api/v1/shows`: returns shows ordered by start time (200)
- `GET /api/v1/shows/:showId/seats`: returns a show's seats ordered by seat number (200), 400 for an invalid UUID, or 404 when the show does not exist
- `POST /api/v1/shows/:showId/reservations`: creates temporary seat holds and pending bookings (201); seats already held/booked return 409
- `DELETE /api/v1/reservations/:bookingId`: cancels a pending or confirmed booking and releases its seat; invalid IDs return 400, missing bookings 404, and repeated cancellations 409

Example response:

```json
{
  "shows": [
    {
      "id": "8a4c2cb6-362b-4d57-98ad-90889231bf23",
      "movie_title": "Paper Moons",
      "screen_name": "Screen 2",
      "starts_at": "2026-11-12T19:00:00.000Z"
    }
  ]
}
```

When PostgreSQL is unavailable, the endpoint returns HTTP 500 with a generic error response; connection details are not included.

Seat-map example (`GET /api/v1/shows/8a4c2cb6-362b-4d57-98ad-90889231bf23/seats`):

```json
{
  "showId": "8a4c2cb6-362b-4d57-98ad-90889231bf23",
  "seats": [
    {
      "seat_id": "b506b3a4-478b-4d0a-a9e6-ec32a1f744c9",
      "seat_number": "A1",
      "status": "available"
    }
  ]
}
```

For a show with no seat assignments, `seats` is an empty array. An unavailable database returns a generic HTTP 500 response.

Reservation example:

```json
{
  "seatIds": ["b506b3a4-478b-4d0a-a9e6-ec32a1f744c9"],
  "customerName": "Test User"
}
```

Reservations hold seats for 15 minutes. The response includes pending booking references and the shared `expiresAt` timestamp. Migration `002_reservation_constraints.sql` stores the customer name and adds unique partial indexes preventing duplicate pending or confirmed bookings for a show/seat pair. Set `RUN_POSTGRES_INTEGRATION=true` to include the PostgreSQL concurrency/constraint integration test after applying migrations; the default test suite uses mocked database connections.

Cancellation updates the existing booking status to `cancelled` without deleting its history. It releases the related `show_seats` record to `available` and clears `hold_expires_at` when no other active pending or confirmed booking exists for that show/seat.

## Database commands

- `npm run db:migrate`: applies ordered SQL files from `database/migrations` once and tracks them in `schema_migrations`
- `npm run db:seed`: adds repeatable sample shows, seats, and show-seat assignments without duplicating existing records

## Commands

- `npm test`: Node built-in test runner with Supertest
- `npm run check`: syntax-check application and tests
- `npm run format`: format repository files
- `npm run format:check`: check formatting

See [ARCHITECTURE.md](ARCHITECTURE.md) and [RUNBOOK.md](RUNBOOK.md).

## GitHub Actions CI

`.github/workflows/ci.yml` runs on pushes to `main` and pull requests targeting `main`. It checks formatting and syntax, applies migrations to an isolated PostgreSQL 18 CI service, runs the full test suite with PostgreSQL integration tests enabled, and builds a Docker image tagged with the commit SHA. The CI image is not pushed to a registry. The CI database and credentials are temporary test-only values; no repository secrets or local database credentials are used. Seeding is omitted because integration tests create their own database fixtures.

## Docker Compose

Copy the template to the ignored local environment file:

```powershell
Copy-Item .env.example .env
```

Set `POSTGRES_PASSWORD` to a strong local secret and use the same password in `DATABASE_URL`, URL-encoding it if necessary. Keep `.env` private and out of version control. Compose supplies the app with the PostgreSQL service hostname `postgres`; `localhost` inside a container points back to that container. PostgreSQL is not published to the host.

Start the complete stack:

```powershell
docker compose up -d --build
```

Compose builds `cinema-ticketing-api:local`, waits for PostgreSQL to become healthy, applies tracked migrations, seeds repeatable sample data, and then starts the API. Migration and seed run as one-shot services, not as part of each API restart. The PostgreSQL data is stored in the named `postgres_data` volume.

Inspect service status and logs:

```powershell
docker compose ps
docker compose logs -f api postgres
Invoke-WebRequest http://localhost:3000/health
Invoke-WebRequest http://localhost:3000/ready
```

Run migrations or seeds manually when needed:

```powershell
docker compose run --rm db-migrate
docker compose run --rm db-seed
```

Stop and remove containers and the Compose network while preserving database files:

```powershell
docker compose down
```

To remove the stack and its persistent database volume:

```powershell
docker compose down --volumes
```

**Warning:** `docker compose down --volumes` permanently deletes the PostgreSQL data stored in `postgres_data`. Back up any data you need before running it.
