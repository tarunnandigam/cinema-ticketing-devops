# Runbook

Use Node.js 24 LTS and PostgreSQL 18. Ensure the local PostgreSQL server is running and the `cinema_ticketing` database exists. In PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Edit `.env` to set `DATABASE_URL` for your local PostgreSQL account. The example value has no password. If password authentication is required, enter it only in the ignored local `.env`; do not paste it into logs, terminal output, or version control. Migrations are recorded in `schema_migrations`; rerunning them skips already applied files. Seeding can be rerun safely.

Check `http://localhost:3000/health`, `/ready`, and `/api/v1`. `npm start` runs without Nodemon.

`/health` returning 200 means the HTTP process responds, independently of the database. `/ready` checks PostgreSQL with `SELECT 1`: 200 means reachable and 503 means unavailable. Its response intentionally hides connection errors and credentials.

Run `npm run format:check`, `npm run check`, and `npm test`. `npm run format` applies Prettier formatting.

Ctrl+C sends SIGINT. The server stops accepting connections and closes the PostgreSQL pool gracefully, with a 10-second timeout. Set `PORT`, `HOST`, `LOG_LEVEL`, or `DATABASE_URL` in local `.env` as needed.

## Troubleshooting

- If migration or readiness reports a generic failure, confirm PostgreSQL is running, the database exists, and `DATABASE_URL` has the correct host, port, database, and local authentication settings. The app does not print the connection error.
- Confirm PostgreSQL is listening on port 5432 and that the selected role can connect and create tables in `cinema_ticketing`.
- Use `npm run db:migrate` to apply pending migrations and `npm run db:seed` to insert sample records. Migration state is in `schema_migrations`.
