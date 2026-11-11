# Architecture

`src/app.js` constructs and exports Express without binding a port, so tests use the same middleware and routes. Its database dependency can be injected for isolated tests. `src/server.js` loads environment settings, validates the port, starts the HTTP listener, and handles SIGINT/SIGTERM shutdown, including closing the PostgreSQL pool.

Helmet sets HTTP security headers. Express parses JSON requests. `pino-http` emits structured request logs using `src/config/logger.js`, which redacts authorization and cookie headers.

`src/config/database.js` owns a shared `pg` pool with bounded connection timeout, pool size, idle timeout, and a generic idle-client error handler. `DATABASE_URL` supplies connection settings. `/health` confirms the process responds without querying PostgreSQL. `/ready` executes `SELECT 1` and returns only a generic unavailable result on failure; it does not expose driver errors.

The initial migration creates `shows`, `seats`, `show_seats`, and `bookings` with UUID keys, constraints, foreign keys, and indexes. `show_seats` prevents duplicate seat assignments for a show; bookings reference a valid show/seat assignment. The migration runner uses a PostgreSQL advisory lock and `schema_migrations` table, applying each SQL file transactionally. The seed script uses stable natural keys and conflict handling so reruns do not duplicate sample data.

`POST /api/v1/shows/:showId/reservations` opens a transaction, locks the show row and requested `show_seats` rows (`FOR KEY SHARE` and ordered `FOR UPDATE`), then creates 15-minute holds and pending booking rows. Expired holds can be reclaimed, with their prior pending rows cancelled in the same transaction. Migration 002 stores `customer_name` and adds partial unique indexes for one pending and one confirmed booking per show/seat pair. The API-level concurrency test uses a lock-aware mock; a separate opt-in test exercises real PostgreSQL locking and the confirmed-booking index when `RUN_POSTGRES_INTEGRATION=true` and the migrations have been applied.

Directories reserve locations for future modules, additional migrations, Terraform, Nginx, monitoring, and GitHub workflows. Cloud deployment, dashboards, and CI workflows are not implemented.

Runtime configuration uses environment variables for host, port, log level, and `DATABASE_URL`. `.env.example` contains a credential-free local URL. Never commit `.env` or credentials.
