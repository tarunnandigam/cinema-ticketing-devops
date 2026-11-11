import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { checkDatabase, getDatabaseConfig } from "../src/config/database.js";

test("database configuration requires DATABASE_URL", () => {
  assert.throws(() => getDatabaseConfig({}), /DATABASE_URL is not configured/);
});

test("database configuration uses bounded connection and pool settings", () => {
  const config = getDatabaseConfig({
    DATABASE_URL: "postgresql://postgres@localhost:5432/cinema_ticketing",
  });

  assert.equal(config.connectionTimeoutMillis, 5_000);
  assert.equal(config.idleTimeoutMillis, 30_000);
  assert.equal(config.max, 10);
  assert.equal(config.application_name, "cinema-ticketing-api");
});

test("database connectivity check issues SELECT 1", async () => {
  const calls = [];
  await checkDatabase({ query: async (sql) => calls.push(sql) });
  assert.deepEqual(calls, ["SELECT 1"]);
});

test("readiness returns 200 when the database query succeeds", async () => {
  const calls = [];
  const app = createApp({
    database: { query: async (sql) => calls.push(sql) },
  });

  const response = await request(app).get("/ready");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: "ready",
    checks: { database: "ok" },
  });
  assert.deepEqual(calls, ["SELECT 1"]);
});

test("readiness returns a sanitized 503 when the database query fails", async () => {
  const app = createApp({
    database: {
      query: async () => {
        throw new Error("sensitive connection information");
      },
    },
  });

  const response = await request(app).get("/ready");
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    status: "not_ready",
    checks: { database: "unavailable" },
  });
  assert.equal(JSON.stringify(response.body).includes("sensitive"), false);
});
