/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness for transpiled server modules. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
const calls = [];
const fixtures = {};
const writes = [];
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (name) => {
    if (name === 'server-only') return {};
    if (name === '@/lib/auth') return { requireActiveEmployee: async () => ({ employeeNo: 12, recordId: 'test-employee' }) };
    if (name === '@/lib/airtable') return {
      createRecord: async (table, fields) => { writes.push({ table, fields }); return {}; },
      formulaString: (value) => `'${value}'`,
      selectName: (value) => typeof value === 'string' ? value : '',
      listRecords: async (table, options) => { calls.push(options); return fixtures[table] || []; },
    };
    return name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name);
  };
  new Function('require', 'module', 'exports', source)(localRequire, mod, mod.exports);
  cache.set(file, mod.exports);
  return mod.exports;
}
(async () => {
  const { calculateOvertimeHours, countWeekdays, nearestFlexibleSchedule, weekBounds } = load('lib/dates.ts');
  const { TABLES, FIELDS, FLEXIBLE_SCHEDULES } = load('lib/constants.ts');
  assert.equal(FLEXIBLE_SCHEDULES.length, 11);
  assert.equal(calculateOvertimeHours('05:00 ~ 14:00', '16:30', false), 2);
  assert.equal(calculateOvertimeHours('06:30 ~ 15:30', '18:00', true), 1);
  assert.equal(calculateOvertimeHours('08:00 ~ 17:00', '19:30', false, true), 1.5);
  assert.equal(calculateOvertimeHours('08:00 ~ 17:00', '18:00', false, true), 0.5);
  assert.equal(calculateOvertimeHours('08:00 ~ 17:00', '19:30', true, true), 1);
  assert.equal(calculateOvertimeHours('08:00 ~ 17:00', '17:30', false, true), 0);
  assert.equal(calculateOvertimeHours('08:00 ~ 17:00', '12:30', false, false, true), 4);
  assert.equal(calculateOvertimeHours('08:00 ~ 17:00', '12:30', false, true, true), 3.5);
  assert.equal(calculateOvertimeHours('08:00 ~ 17:00', '12:30', true, false, true), 3);
  assert.equal(calculateOvertimeHours('05:00 ~ 14:00', '09:00', false, false, true), 4);
  assert.equal(calculateOvertimeHours('08:00 ~ 17:00', '07:00', false, false, true), 0);
  assert.equal(countWeekdays('2026-09-04', '2026-09-07'), 2);
  assert.deepEqual(weekBounds('2026-09-10'), { start: '2026-09-07', end: '2026-09-13' });
  assert.deepEqual(weekBounds('2026-09-13'), { start: '2026-09-07', end: '2026-09-13' });
  assert.equal(nearestFlexibleSchedule(new Date('2026-09-10T22:42:00Z')), '07:30 ~ 16:30');
  fixtures[TABLES.flexible] = Array.from({ length: 101 }, (_, i) => ({
    id: `request-${i}`, createdTime: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    fields: { [FIELDS.flexible.date]: i === 100 ? '2025-01-01' : '2026-12-01' },
  }));
  const items = await load('lib/data.ts').getEmployeeRequests(12);
  assert.equal(items.length, 100);
  assert.equal(items[0].id, 'request-100', 'sort by submission time, not work date');
  for (const options of calls) {
    assert.match(options.filterByFormula, /^ARRAYJOIN\(\{fld\w+\}\)='12'$/);
    assert.equal(options.maxRecords, undefined, 'fetch all pages before sorting');
  }
  // Exercise the POST boundary without writing to the live Airtable base.
  fixtures[TABLES.flexible] = [];
  fixtures[TABLES.overtime] = [];
  const { POST } = load('app/api/overtime/route.ts');
  const submit = (mealFields) => POST({ json: async () => ({ date: '2026-09-23', endTime: '19:00', reason: '테스트', ...mealFields }) });
  for (const mealChoice of ['internal', 'external', 'none']) {
    const internalMeal = mealChoice === 'internal';
    const externalMeal = mealChoice === 'external';
    const response = await submit({ mealChoice });
    assert.equal(response.status, 201);
    const write = writes.at(-1);
    assert.equal(write.fields.fldRuBu1RLnZmyvdA, internalMeal);
    assert.equal(write.fields.fldqPuT69Sntumaio, externalMeal);
    assert.equal(write.fields.fldtLf1cT7hF0FGu3, false);
    assert.equal((await response.json()).message, `${externalMeal ? 1 : internalMeal ? 1.5 : 2}시간 잔업 신청이 등록되었습니다.`);
  }
  const halfHourResponse = await POST({ json: async () => ({ date: '2026-09-23', endTime: '18:00', mealChoice: 'internal', reason: '테스트' }) });
  assert.equal(halfHourResponse.status, 201);
  assert.equal((await halfHourResponse.json()).message, '0.5시간 잔업 신청이 등록되었습니다.');
  const holidayResponse = await submit({ endTime: '12:30', mealChoice: 'internal', weekendHoliday: true });
  assert.equal(holidayResponse.status, 201);
  assert.equal((await holidayResponse.json()).message, '3.5시간 잔업 신청이 등록되었습니다.');
  assert.equal(writes.at(-1).fields.fldtLf1cT7hF0FGu3, true);
  assert.equal((await submit({ mealChoice: 'none', weekendHoliday: false })).status, 201);
  assert.equal(writes.at(-1).fields.fldtLf1cT7hF0FGu3, false);
  const writeCount = writes.length;
  for (const weekendHoliday of ['true', 1, null, []]) {
    assert.equal((await submit({ mealChoice: 'none', weekendHoliday })).status, 400);
  }
  assert.equal((await submit({ endTime: '21:00', mealChoice: 'none', weekendHoliday: true })).status, 409);
  for (const mealChoice of [undefined, null, '', 'invalid', true, ['internal', 'external']]) {
    assert.equal((await submit({ mealChoice })).status, 400);
  }
  assert.equal((await submit({ internalMeal: true, externalMeal: true })).status, 400);
  for (const reason of [undefined, null, '', '   ', '\n\t']) {
    assert.equal((await submit({ mealChoice: 'none', reason })).status, 400);
  }
  assert.equal(writes.length, writeCount);
  console.log('PASS: three meal choices, field mapping, required meal and nonblank reason validation');
  console.log('PASS: holiday checkbox mapping, boolean validation, start-time calculation and weekly limit');
  console.log('PASS: early schedules, meal deduction, weekend exclusion, exact employee formula, newest 100 submissions');
  // Visitor history must still include current reservations after 500 older rows.
  const { VISITOR_TABLES, VISITOR_FIELDS } = load('lib/constants.ts');
  const vf = VISITOR_FIELDS.reservations;
  const hf = VISITOR_FIELDS.master;
  process.env.VISITOR_AIRTABLE_TOKEN = 'local-test-only';
  fixtures[VISITOR_TABLES.master] = [
    { id: 'host-one', fields: { [hf.employeeNo]: 12, [hf.name]: '담당자1', [hf.phone]: 'test-one' } },
    { id: 'host-two', fields: { [hf.employeeNo]: 13, [hf.name]: '담당자2', [hf.phone]: 'test-two' } },
  ];
  fixtures[VISITOR_TABLES.reservations] = Array.from({ length: 500 }, (_, i) => ({
    id: `old-visitor-${i}`, fields: { [vf.visitAt]: '2026-01-01T01:00:00Z', [vf.host]: ['host-one'] },
  }));
  fixtures[VISITOR_TABLES.reservations].push(
    { id: 'current-visitor', fields: { [vf.visitAt]: '2026-09-29T15:30:00Z', [vf.host]: ['host-one', { id: 'host-two' }] } },
    { id: 'cancelled-visitor', fields: { [vf.visitAt]: '2026-09-29T15:30:00Z', [vf.host]: ['host-one'], [vf.cancelled]: true } },
  );
  const visitor = load('lib/visitors.ts');
  const hosts = await visitor.getVisitorHosts();
  const mapped = await visitor.getVisitorReservations(hosts);
  assert.equal(calls.at(-1).maxRecords, undefined, 'visitor history must fetch every page');
  assert.equal(mapped.length, 502);
  assert.equal(mapped[500].visitDate, '2026-09-30');
  assert.equal(mapped[500].visitTime, '00:30');
  assert.deepEqual(mapped[500].hostNames, ['담당자1', '담당자2']);
  assert.deepEqual(mapped[500].hostPhones, ['test-one', 'test-two']);
  assert.equal(mapped[501].cancelled, true);
  assert.equal(await visitor.getTodayVisitorCount(12, '2026-09-30'), 1);
  assert.equal(await visitor.getTodayVisitorCount(13, '2026-09-30'), 1);
  const myVisits = await visitor.getEmployeeVisitorRequests(13);
  assert.deepEqual(myVisits.map((item) => item.id), ['current-visitor']);
  assert.equal(myVisits[0].category, 'visitors');
  assert.equal(myVisits[0].dateLabel, '2026-09-30 00:30');
  const hostOneVisits = await visitor.getEmployeeVisitorRequests(12);
  assert.equal(hostOneVisits.length, 502);
  assert.equal(hostOneVisits.find((item) => item.id === 'cancelled-visitor').status, '예약취소');
  assert.deepEqual(await visitor.getEmployeeVisitorRequests(999), []);
  console.log('PASS: personal visitor history, multi-host inclusion, other-employee exclusion, cancellations');
  console.log('PASS: visitor pagination, Seoul date rollover, multiple hosts, cancelled notification exclusion');
})().catch((error) => { console.error(error); process.exitCode = 1; });
