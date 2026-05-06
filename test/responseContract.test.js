process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

const assertErrorContract = (body) => {
  assert.equal(body.success, false);
  assert.equal(typeof body.error, "string");
  assert.equal(typeof body.code, "string");
  assert.ok(Object.prototype.hasOwnProperty.call(body, "requestId"));
};

test("returns uniform 404 response contract", async () => {
  const res = await request(app).get("/unknown-endpoint");
  assert.equal(res.status, 404);
  assertErrorContract(res.body);
  assert.equal(res.body.code, "NOT_FOUND");
});

test("returns uniform 401 response contract for missing JWT", async () => {
  const res = await request(app).get("/api/player/all?user=0x1111111111111111111111111111111111111111");
  assert.equal(res.status, 401);
  assertErrorContract(res.body);
});

test("returns uniform 400 response contract for invalid login body", async () => {
  const res = await request(app).post("/api/player/login").send({});
  assert.equal(res.status, 400);
  assertErrorContract(res.body);
  assert.equal(res.body.code, "BAD_REQUEST");
});

test("returns uniform 400 response contract for invalid auto-login body", async () => {
  const res = await request(app).post("/api/player/login/auto").send({ source: "browser" });
  assert.equal(res.status, 400);
  assertErrorContract(res.body);
  assert.equal(res.body.code, "VALIDATION_ERROR");
});
