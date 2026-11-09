# Architecture

`src/app.js` constructs and exports Express without binding a port, so tests use the same middleware and routes. `src/server.js` loads environment settings, validates the port, starts the HTTP listener, and handles SIGINT/SIGTERM shutdown.

Helmet sets HTTP security headers. Express parses JSON requests. `pino-http` emits structured request logs using `src/config/logger.js`, which redacts authorization and cookie headers.

`/health` confirms the process responds. `/ready` returns 503 with `database: not_configured`; no PostgreSQL connection check exists. `/api/v1` identifies the initial API.

Directories reserve locations for future modules, migrations, scripts, Terraform, Nginx, monitoring, and GitHub workflows. They are placeholders: database integration, deployment, cloud resources, dashboards, and CI workflows are not implemented.

Runtime configuration uses environment variables with defaults for host, port, and log level. `.env.example` contains placeholders only. Never commit `.env` or credentials.
