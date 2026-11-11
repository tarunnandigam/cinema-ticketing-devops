import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp({
  database: {
    query: async () => {
      throw new Error("database unavailable");
    },
  },
});

let server;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("GET /health reports process health", async () => {
  const response = await request(server).get("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("GET /ready reports database unavailable", async () => {
  const response = await request(server).get("/ready");
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    status: "not_ready",
    checks: { database: "unavailable" },
  });
});

test("GET /api/v1 reports API availability", async () => {
  const response = await request(server).get("/api/v1");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    name: "cinema-ticketing-api",
    version: "v1",
    status: "available",
  });
});
