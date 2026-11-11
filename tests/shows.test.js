import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

test("GET /api/v1/shows returns multiple shows with selected fields", async () => {
  const shows = [
    {
      id: "show-early",
      movie_title: "Paper Moons",
      screen_name: "Screen 2",
      starts_at: "2026-11-12T19:00:00.000Z",
    },
    {
      id: "show-late",
      movie_title: "The Last Horizon",
      screen_name: "Screen 1",
      starts_at: "2026-11-12T21:00:00.000Z",
    },
  ];
  let executedQuery;
  const app = createApp({
    database: {
      query: async (sql) => {
        executedQuery = sql;
        return { rows: shows };
      },
    },
  });

  const response = await request(app).get("/api/v1/shows");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { shows });
  assert.match(
    executedQuery,
    /SELECT id, movie_title, screen_name, starts_at/i,
  );
  assert.match(executedQuery, /ORDER BY starts_at ASC/i);
});

test("GET /api/v1/shows returns an empty list when there are no shows", async () => {
  const app = createApp({
    database: { query: async () => ({ rows: [] }) },
  });

  const response = await request(app).get("/api/v1/shows");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { shows: [] });
});

test("GET /api/v1/shows returns a generic 500 when the database fails", async () => {
  const app = createApp({
    database: {
      query: async () => {
        throw new Error("sensitive database connection detail");
      },
    },
  });

  const response = await request(app).get("/api/v1/shows");

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    status: "error",
    message: "Unable to retrieve shows",
  });
  assert.equal(JSON.stringify(response.body).includes("sensitive"), false);
});
