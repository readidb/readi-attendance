/* eslint-disable @typescript-eslint/no-require-imports -- Isolated route tests with an in-memory Airtable. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
const records = new Map();
const writes = [];
let employee = null;
let authCalls = 0;
let constants;
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)((name) => {
    if (name === 'server-only') return {};
    if (name === '@/lib/auth') return { requireActiveEmployee: async () => { authCalls++; return employee; } };
    if (name === '@/lib/airtable') return {
      listRecords: async (table, options) => {
        assert.equal(options.baseId, constants.VISITOR_BASE_ID);
        return [...records.values()].filter((record) => record.table === table);
      },
      getRecord: async (table, id, base) => {
        assert.equal(base, constants.VISITOR_BASE_ID);
        const record = records.get(id);
        return record?.table === table ? record : null;
      },
      createRecord: async (table, fields, base) => {
        assert.equal(base, constants.VISITOR_BASE_ID);
        writes.push({ table, fields });
        const record = { id: 'reservation-one', table, fields };
        records.set(record.id, record);
        return record;
      },
      updateRecord: async (table, id, fields, base) => {
        assert.equal(base, constants.VISITOR_BASE_ID);
        writes.push({ table, fields });
        const record = records.get(id);
        record.fields = { ...record.fields, ...fields };
        return record;
      },
      selectName: (value) => typeof value === 'string' ? value : '',
    };
    return name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name);
  }, mod, mod.exports);
  cache.set(file, mod.exports);
  return mod.exports;
}

(async () => {
  process.env.VISITOR_AIRTABLE_TOKEN = 'local-test-only';
  constants = load('lib/constants.ts');
  const { VISITOR_TABLES: tables, VISITOR_FIELDS: fields } = constants;
  records.set('host-one', { id: 'host-one', table: tables.master, fields: {
    [fields.master.employeeNo]: 12, [fields.master.name]: '담당자',
  } });
  const shared = load('app/api/visitors/calendar/route.ts');
  const personal = load('app/api/visitors/route.ts');
  const request = (body) => ({ json: async () => body });
  const draft = {
    visitDate: '2026-10-06', visitTime: '09:30', location: '1공장',
    hostRecordIds: ['host-one'], company: '테스트 업체', visitorName: '홍길동',
    headcount: 2, purpose: '회의', vehicleNo: '12가3456', note: '안내 사항',
  };

  let response = await shared.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).data.currentHostRecordId, '');
  assert.equal((await shared.POST(request(draft))).status, 201);
  assert.equal(writes.at(-1).table, tables.reservations);
  assert.equal(writes.at(-1).fields[fields.reservations.note], '방문자명: 홍길동\n안내 사항');
  assert.equal(writes.at(-1).fields[fields.reservations.visitAt], '2026-10-06T09:30:00+09:00');
  let data = (await (await shared.GET()).json()).data;
  assert.equal(data.reservations[0].visitorName, '홍길동');
  assert.equal(data.reservations[0].note, '안내 사항');
  assert.equal(data.reservations[0].visitTime, '09:30');
  assert.equal(authCalls, 0, 'shared routes must never require an employee session');

  const count = writes.length;
  assert.equal((await personal.GET()).status, 401);
  assert.equal((await personal.POST(request(draft))).status, 401);
  assert.equal((await personal.PATCH(request({ id: 'reservation-one', action: 'cancel' }))).status, 401);
  assert.equal(writes.length, count);
  employee = { employeeNo: 12 };
  data = (await (await personal.GET()).json()).data;
  assert.equal(data.currentHostRecordId, 'host-one');
  assert.equal(data.reservations[0].visitorName, '홍길동', 'both endpoints use the same records');

  assert.equal((await shared.PATCH(request({ ...draft, id: 'reservation-one', visitorName: '김방문', note: '수정 비고' }))).status, 200);
  const legacyDraft = { ...draft, id: 'reservation-one', note: '기존 화면 수정' };
  delete legacyDraft.visitorName;
  assert.equal((await personal.PATCH(request(legacyDraft))).status, 200);
  assert.equal(writes.at(-1).fields[fields.reservations.note], '방문자명: 김방문\n기존 화면 수정');
  for (const invalid of [{ visitDate: '2026-02-30' }, { visitTime: '25:00' }, { headcount: 0 }, { hostRecordIds: [] }, { hostRecordIds: ['missing'] }]) {
    assert.equal((await shared.POST(request({ ...draft, ...invalid }))).status, 400);
  }
  assert.equal((await shared.PATCH(request({ ...draft, id: 'missing' }))).status, 404);
  assert.equal((await shared.PATCH(request({ id: 'reservation-one', action: 'cancel' }))).status, 200);
  assert.equal((await shared.PATCH(request({ ...draft, id: 'reservation-one' }))).status, 400);
  data = (await (await shared.GET()).json()).data;
  assert.equal(data.reservations[0].cancelled, true);
  const writesAfterCancel = writes.length;
  assert.equal((await shared.PATCH(request({ id: 'reservation-one', action: 'cancel' }))).status, 200);
  assert.equal(writes.length, writesAfterCancel, 'repeat cancellation must not write again');
  const notes = load('lib/visitor-note.ts');
  assert.deepEqual(notes.splitVisitorNote('기존 비고\n그대로'), { visitorName: '', note: '기존 비고\n그대로' });
  console.log('PASS: shared CRUD without keys/sessions, protected personal API, shared records, input validation, cancellation and visitor-name preservation');
})().catch((error) => { console.error(error); process.exitCode = 1; });
