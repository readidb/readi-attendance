/* eslint-disable @typescript-eslint/no-require-imports -- Isolated authentication regression harness. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const employeeA = { recordId: 'employee-a', employeeNo: 12 };
const employeeB = { recordId: 'employee-b', employeeNo: 13 };
const keys = new Map([['test-a', employeeA], ['test-b', employeeB]]);
let current = null;
let writes = 0;
function load(file, modules) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => name in modules ? modules[name] : require(name), mod, mod.exports);
  return mod.exports;
}
const auth = {
  findActiveEmployeeByKey: async (key) => keys.get(key) || null,
  requireActiveEmployee: async () => current,
  setEmployeeSession: async (id) => { current = id === employeeA.recordId ? employeeA : employeeB; writes += 1; },
  clearEmployeeSession: async () => { current = null; },
};
const { GET } = load('app/api/auth/route.ts', { '@/lib/auth': auth });
const page = load('app/page.tsx', {
  'next/navigation': { redirect: (url) => { throw Object.assign(new Error('redirect'), { destination: url }); } },
  '@/components/AttendanceApp': { default: () => null },
  '@/lib/auth': auth,
  '@/lib/data': { getEmployeeRequests: async () => [], getPublishedNotices: async () => [], publicEmployee: (employee) => ({ employeeNo: employee.employeeNo }) },
  '@/lib/dates': { todayInSeoul: () => '2026-10-01' },
  '@/lib/visitors': { getTodayVisitorCount: async () => 0 },
}).default;
const request = (key) => ({ url: `https://example.test/api/auth?key=${encodeURIComponent(key)}`, nextUrl: new URL(`https://example.test/api/auth?key=${encodeURIComponent(key)}`) });
const render = (key) => page({ searchParams: Promise.resolve(key === undefined ? {} : { key }) });
(async () => {
  await assert.rejects(() => render('test-a'), (error) => error.destination === '/api/auth?key=test-a');
  let result = await GET(request('test-a'));
  assert.equal(result.headers.get('location'), 'https://example.test/?key=test-a');
  assert.equal(current.recordId, 'employee-a');
  let rendered = await render('test-a');
  assert.equal(rendered.props.initialData.employee.employeeNo, 12);
  const before = writes;
  await render('test-a');
  assert.equal(writes, before, 'matching personal URL must not reauthenticate or loop');
  await assert.rejects(() => render('test-b'), (error) => error.destination === '/api/auth?key=test-b');
  await GET(request('test-b'));
  rendered = await render('test-b');
  assert.equal(rendered.props.initialData.employee.employeeNo, 13);
  assert.equal((await render()).props.initialData.employee.employeeNo, 13);
  result = await GET(request('invalid-test-key'));
  assert.equal(result.headers.get('location'), 'https://example.test/?error=invalid-key');
  assert.equal(current, null, 'an invalid link must clear the prior employee session');
  assert.equal((await render()).props.initialData, null);
  await assert.rejects(() => render(''), (error) => error.destination === '/api/auth');
  keys.set('test a&b', employeeA);
  result = await GET(request('test a&b'));
  assert.equal(new URL(result.headers.get('location')).searchParams.get('key'), 'test a&b');
  console.log('PASS: personal URL retention, employee switching, no redirect loop, invalid key isolation, URL encoding');
})().catch((error) => { console.error(error); process.exitCode = 1; });
