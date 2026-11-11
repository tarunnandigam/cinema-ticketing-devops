import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

const showId = "8a4c2cb6-362b-4d57-98ad-90889231bf23";

test("GET /api/v1/shows/:showId/seats returns the ordered seat map", async () => {
  const seats = [
    { seat_id: "seat-a1", seat_number: "A1", status: "available" },
    { seat_id: "seat-b1", seat_number: "B1", status: "booked" },
  ];
  const calls = [];
  const app = createApp({
    database: {
      query: async (sql, values) => {
        calls.push({ sql, values });
        return calls.length === 1
          ? { rows: [{ id: showId }] }
          : { rows: seats };
      },
    },
  });

  const response = await request(app).get(`/api/v1/shows/${showId}/seats`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { showId, seats });
  assert.deepEqual(
    calls.map(({ values }) => values),
    [[showId], [showId]],
  );
  assert.match(calls[1].sql, /FROM show_seats\s+INNER JOIN seats/i);
  assert.match(calls[1].sql, /ORDER BY seats\.seat_number ASC/i);
  assert.match(calls[1].sql, /WHERE show_seats\.show_id = \$1/i);
});

test("GET /api/v1/shows/:showId/seats rejects an invalid UUID", async () => {
  let queryCount = 0;
  const app = createApp({
    database: {
      query: async () => {
        queryCount += 1;
        return { rows: [] };
      },
    },
  });

  const response = await request(app).get("/api/v1/shows/not-a-uuid/seats");

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    status: "error",
    message: "showId must be a valid UUID",
  });
  assert.equal(queryCount, 0);
});

test("GET /api/v1/shows/:showId/seats returns 404 when the show does not exist", async () => {
  const calls = [];
  const app = createApp({
    database: {
      query: async (sql, values) => {
        calls.push({ sql, values });
        return { rows: [] };
      },
    },
  });

  const response = await request(app).get(`/api/v1/shows/${showId}/seats`);

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    status: "error",
    message: "Show not found",
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].values, [showId]);
});

test("GET /api/v1/shows/:showId/seats returns an empty seat list for a show with no seats", async () => {
  let queryCount = 0;
  const app = createApp({
    database: {
      query: async () => {
        queryCount += 1;
        return queryCount === 1 ? { rows: [{ id: showId }] } : { rows: [] };
      },
    },
  });

  const response = await request(app).get(`/api/v1/shows/${showId}/seats`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { showId, seats: [] });
});

test("GET /api/v1/shows/:showId/seats returns a generic 500 on database failure", async () => {
  const app = createApp({
    database: {
      query: async () => {
        throw new Error("sensitive database connection details");
      },
    },
  });

  const response = await request(app).get(`/api/v1/shows/${showId}/seats`);

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    status: "error",
    message: "Unable to retrieve show seats",
  });
  assert.equal(JSON.stringify(response.body).includes("sensitive"), false);
});
