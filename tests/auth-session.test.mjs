import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const loadDependency = createRequire(import.meta.url);
const { NextRequest } = loadDependency("next/server");
const { ResponseCookies } = loadDependency("next/dist/compiled/@edge-runtime/cookies");
const TEST_SECRET = "test-secret-with-at-least-32-characters";

// Run the actual TS modules with an isolated cookie store and Airtable fixtures.
// No real employee keys, credentials, or Airtable writes are used.
function setup({ token, production = false } = {}) {
  const cache = new Map();
  const headers = new Headers();
  const outgoing = new ResponseCookies(headers);
  const jar = new Map(token ? [["readi_session", token]] : []);
  let now = Date.now();
  const writes = [];
  const lookups = [];
  const records = new Map();
  let constants;
  const cookieStore = {
    get: (name) => jar.has(name) ? { value: jar.get(name) } : undefined,
    set(name, value, options) {
      jar.set(name, value);
      outgoing.set(name, value, options);
    },
    delete(name) {
      jar.delete(name);
      outgoing.delete(name);
    },
  };
  const airtable = {
    formulaString: (value) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`,
    selectName: (value) => typeof value === "string" ? value : value?.name || "",
    async listRecords(table, options) {
      if (table !== constants.TABLES.master) return [];
      lookups.push(options.filterByFormula);
      return [...records.values()].filter((record) =>
        record.fields[constants.FIELDS.master.status] === "재직중"
        && options.filterByFormula.includes(`=${airtable.formulaString(record.key)},`));
    },
    async getRecord(_table, id) { return records.get(id) || null; },
    async createRecord(table, fields) {
      writes.push({ table, fields });
      return { id: "created", fields };
    },
  };
  const mocks = {
    "server-only": {},
    "next/headers": { cookies: async () => cookieStore },
    "next/navigation": { redirect(url) { throw Object.assign(new Error("redirect"), { url }); } },
    "@/lib/airtable": airtable,
    "@/lib/data": { getDashboardData: async (employee) => ({ employee }) },
    "@/components/AttendanceApp": { __esModule: true, default: () => null },
    "@/lib/visitors": {
      getVisitorHosts: async () => [{ recordId: "recA", employeeNo: 1 }],
      getVisitorReservations: async () => [{ id: "reservation" }],
      visitorAirtableToken: () => "fixture",
    },
  };
  function load(relative) {
    const filename = path.resolve(import.meta.dirname, "..", relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
      fileName: filename,
    }).outputText;
    const localRequire = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`);
      return loadDependency(name);
    };
    const clock = class extends Date { static now() { return now; } };
    new Function("require", "module", "exports", "process", "Date", compiled)(
      localRequire, loadedModule, loadedModule.exports,
      { env: { SESSION_SECRET: TEST_SECRET, NODE_ENV: production ? "production" : "development" } },
      clock,
    );
    return loadedModule.exports;
  }
  constants = load("lib/constants.ts");
  for (const [id, number, key] of [["recA", 1, "key-A"], ["recB", 2, "key-B"]]) {
    records.set(id, { id, key, fields: {
      [constants.FIELDS.master.status]: "재직중",
      [constants.FIELDS.master.employeeNo]: number,
      [constants.FIELDS.master.name]: id,
      [constants.FIELDS.master.remainingLeave]: 10,
    } });
  }
  return {
    auth: load("lib/auth.ts"), route: load("app/api/auth/route.ts"), page: load("app/page.tsx").default,
    load, constants, records, headers, writes, lookups,
    token: () => jar.get("readi_session"),
    advance: (days) => { now += days * 24 * 60 * 60 * 1000; },
    setStatus: (id, status) => { records.get(id).fields[constants.FIELDS.master.status] = status; },
    login: (key) => load("app/api/auth/route.ts").GET(new NextRequest(`https://v2.example/api/auth?key=${encodeURIComponent(key)}`)),
  };
}

test("first personal link authenticates and redirects to the base URL with a persistent, secure cookie", async () => {
  const s = setup({ production: true });
  await assert.rejects(s.page({ searchParams: Promise.resolve({ key: "key-A" }) }), { url: "/api/auth?key=key-A" });
  const response = await s.login("key-A");
  assert.equal(response.headers.get("location"), "https://v2.example/");
  const cookie = s.headers.get("set-cookie");
  for (const flag of ["Max-Age=15552000", "HttpOnly", "Secure", "SameSite=lax", "Path=/"]) {
    assert.ok(cookie.toLowerCase().includes(flag.toLowerCase()), flag);
  }
  assert.ok(s.lookups[0].includes(s.constants.FIELDS.master.mobileKey));
  assert.equal((await s.auth.requireActiveEmployee()).recordId, "recA");
});

test("development cookie does not require HTTPS", async () => {
  const s = setup();
  await s.login("key-A");
  assert.ok(!s.headers.get("set-cookie").toLowerCase().includes("secure"));
});

test("a new browser request with only the saved cookie opens the base URL, including a bookmark", async () => {
  const first = setup();
  await first.login("key-A");
  const reopened = setup({ token: first.token() });
  reopened.advance(179);
  const element = await reopened.page({ searchParams: Promise.resolve({}) });
  assert.equal(element.props.initialData.employee.recordId, "recA");
  assert.equal(reopened.lookups.length, 0, "base URL does not need the mobile key");
  reopened.advance(2);
  assert.equal(await reopened.auth.requireActiveEmployee(), null);
});

test("a different personal link replaces an existing employee session", async () => {
  const s = setup();
  await s.login("key-A");
  await assert.rejects(s.page({ searchParams: Promise.resolve({ key: "key-B" }) }), { url: "/api/auth?key=key-B" });
  await s.login("key-B");
  const element = await s.page({ searchParams: Promise.resolve({}) });
  assert.equal(element.props.initialData.employee.recordId, "recB");
});

test("the same personal link upgrades an existing 14-day session to 180 days", async () => {
  const encoded = Buffer.from(JSON.stringify({
    employeeRecordId: "recA", expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", TEST_SECRET).update(encoded).digest("base64url");
  const s = setup({ token: `${encoded}.${signature}` });
  await assert.rejects(s.page({ searchParams: Promise.resolve({ key: "key-A" }) }), { url: "/api/auth?key=key-A" });
  await s.login("key-A");
  s.advance(15);
  assert.equal((await s.auth.requireActiveEmployee()).recordId, "recA");
});

test("invalid, empty, and oversized keys clear the previous session and block access", async () => {
  for (const key of ["invalid", "", " ", "x".repeat(201)]) {
    const s = setup();
    await s.login("key-A");
    const response = await s.login(key);
    assert.equal(response.headers.get("location"), "https://v2.example/?error=invalid-key");
    assert.equal(s.token(), undefined);
    assert.match(s.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/i);
    assert.equal(await s.auth.requireActiveEmployee(), null);
  }
});

test("duplicate key parameters are rejected through the session-clearing route", async () => {
  const s = setup();
  await assert.rejects(s.page({ searchParams: Promise.resolve({ key: ["key-A", "key-B"] }) }), { url: "/api/auth" });
});

test("server rechecks retired and inactive employees on base URL and all protected APIs", async () => {
  for (const status of ["퇴사", "비활성", "휴직"]) {
    const s = setup();
    await s.login("key-A");
    s.setStatus("recA", status);
    const element = await s.page({ searchParams: Promise.resolve({}) });
    assert.equal(element.props.initialData, null);
    for (const endpoint of ["dashboard", "employee", "history", "notices", "visitors"]) {
      const route = s.load(`app/api/${endpoint}/route.ts`);
      assert.equal((await route.GET(new NextRequest(`https://v2.example/api/${endpoint}`))).status, 401);
    }
    for (const endpoint of ["leave", "flexible", "overtime", "visitors"]) {
      const route = s.load(`app/api/${endpoint}/route.ts`);
      assert.equal((await route.POST(new NextRequest(`https://v2.example/api/${endpoint}`, { method: "POST" }))).status, 401);
    }
    assert.equal((await s.login("key-A")).headers.get("location"), "https://v2.example/?error=invalid-key");
    assert.equal(s.token(), undefined);
  }
});

test("missing employee records and altered session signatures cannot authenticate", async () => {
  const s = setup();
  await s.login("key-A");
  const tampered = setup({ token: `${s.token()}x` });
  assert.equal(await tampered.auth.requireActiveEmployee(), null);
  s.records.delete("recA");
  assert.equal(await s.auth.requireActiveEmployee(), null);
});

test("attendance and visitor reads and submissions still use the cookie employee without a key", async () => {
  const s = setup();
  await s.login("key-B");
  const dashboard = await s.load("app/api/dashboard/route.ts").GET();
  assert.equal((await dashboard.json()).data.employee.recordId, "recB");
  const visitors = s.load("app/api/visitors/route.ts");
  assert.equal((await visitors.GET()).status, 200);
  const post = (endpoint, body) => new NextRequest(`https://v2.example/api/${endpoint}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const leave = await s.load("app/api/leave/route.ts").POST(post("leave", {
    type: "연차", startDate: "2026-10-06", endDate: "2026-10-06", reason: "test",
  }));
  assert.equal(leave.status, 201);
  assert.deepEqual(s.writes[0].fields[s.constants.FIELDS.leave.employee], ["recB"]);
  const reservation = await visitors.POST(post("visitors", {
    visitDate: "2026-10-06", visitTime: "10:00", location: "office", hostRecordIds: ["recB"],
    company: "test", headcount: 1, purpose: "test",
  }));
  assert.equal(reservation.status, 201);
  assert.deepEqual(s.writes[1].fields[s.constants.VISITOR_FIELDS.reservations.host], ["recB"]);
});
