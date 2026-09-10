/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness for transpiled server modules. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
const calls = [];
const fixtures = {};
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (name) => {
    if (name === 'server-only') return {};
    if (name === '@/lib/airtable') return {
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
  console.log('PASS: early schedules, meal deduction, weekend exclusion, exact employee formula, newest 100 submissions');
})().catch((error) => { console.error(error); process.exitCode = 1; });
