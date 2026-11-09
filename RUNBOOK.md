# Runbook

Use Node.js 24 LTS. In PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Check `http://localhost:3000/health`, `/ready`, and `/api/v1`. `npm start` runs without Nodemon.

`/health` returning 200 means the HTTP process responds. `/ready` currently returns 503 because PostgreSQL connectivity is not implemented; this is expected.

Run `npm run format:check`, `npm run check`, and `npm test`. `npm run format` applies Prettier formatting.

Ctrl+C sends SIGINT. The server stops accepting connections and closes gracefully, with a 10-second timeout. Set `PORT`, `HOST`, or `LOG_LEVEL` in local `.env` as needed. This scaffold has no database or deployment operations.
