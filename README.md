# Cinema Ticketing Platform

Initial backend foundation for the ALGIONS AI LABS PRIVATE LIMITED DevOps & Cloud Engineering internship assessment.

## Current scope

This repository contains an Express 5 API shell with process health, readiness, and API version routes. PostgreSQL is not integrated; Docker, CI/CD, cloud infrastructure, and Terraform are not implemented. Readiness intentionally returns HTTP 503 until a database check exists.

## Requirements and run

Use Node.js 24 LTS. In PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

`.env` is optional and ignored by Git. `npm start` starts production mode.

## Endpoints

- `GET /health`: process responds (200)
- `GET /ready`: database not configured (503)
- `GET /api/v1`: API identity (200)

## Commands

- `npm test`: Node built-in test runner with Supertest
- `npm run check`: syntax-check application and tests
- `npm run format`: format repository files
- `npm run format:check`: check formatting

See [ARCHITECTURE.md](ARCHITECTURE.md) and [RUNBOOK.md](RUNBOOK.md).
