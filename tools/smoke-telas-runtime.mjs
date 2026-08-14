// Smoke test RUNTIME: importa cada tela e tenta renderizar num banco vazio.
// Se a tela tem gap (helper nao definido), vai dar ReferenceError ao chamar renderX.
// Uso: node tools/smoke-telas-runtime.mjs
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const wasmPath = path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm');
const schemaPath = path.join(root, 'src/js/backend/schema.sql');

const SQL = await initSqlJs({ locateFile: () => wasmPath });
const db = new SQL.Database();
db.exec(fs.readFileSync(schemaPath, 'utf8'));

// Mock de api com operacoes minimas
let nextId = 1;
const api = (canal, dados = {}) => {
  if (canal === 'contextos:listar') return [[1, 'Teste', '', 1, '2026-08-14']];
  if (canal === 'contextos:obter') return { id: dados.id, nome: 'Teste', descricao: '', ativo: 1 };
  if (canal === 'contextos:criar') { const id = nextId++; db.run('INSERT INTO contextos_financeiros (id, nome) VALUES (?, ?)', [id, dados.nome || 'novo']); return id; }
  if (canal === 'cartoes:listar') return [];
  if (canal === 'categorias:listar') return [];
  if (canal === 'contas:listar') return [];
  if (canal === 'clientes:listar') return [];
  if (canal === 'fornecedores:listar') return [];
  if (canal === 'projetos:listar') return [];
  if (canal === 'centros_custo:listar') return [];
  if (canal === 'tags:listar') return [];
  if (canal === 'parcelamentos:listar') return [];
  if (canal === 'parcelamentos:calendarioCompleto') return [];
  if (canal === 'parcelamentos:detectarDoExtrato') return [];
  if (canal === 'custosFixos:resumoMes') return { mes: '2026-08', totalPrevistoCentavos: 0, totalPagoCentavos: 0, percentualPago: 0, custosFixos: [] };
  if (canal === 'custosFixos:listar') return [];
  if (canal === 'relatorios:balancete') return [];
  if (canal === 'importacao:listar') return [];
  if (canal === 'faturas:listarDetalhadas') return [];
  if (canal === 'dashboard:resumo') return { receitas: 0, despesas: 0, saldo: 0, lancamentos: 0 };
  if (canal === 'dashboard:saldoPorConta') return [];
  if (canal === 'dashboard:faturaAtual') return null;
  if (canal === 'parcelamentos:resumoCompleto') return [];
  if (canal === 'lancamentos:listar') return [];
  if (canal === 'transferencias:listar') return [];
  if (canal === 'baixas:listar') return [];
  if (canal === 'baixas:saldo') return 0;
  if (canal === 'configuracoes:listar') return {};
  if (canal === 'configuracoes:obter') return { valor: '', tipo: 'texto' };
  // Fallback generico
  return null;
};

// Mock do DOM mais completo
const mockEl = () => {
  const el = {
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: {},
    dataset: {},
    children: [],
    childNodes: [],
    addEventListener() {},
    removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {},
    remove() {},
    setAttribute() {},
    getAttribute: () => null,
    hasAttribute: () => false,
    insertBefore(c, ref) { this.children.push(c); return c; },
    querySelector: () => null,
    querySelectorAll: () => [],
    focus() {},
    click() {},
    dispatchEvent() {},
    innerHTML: '',
    textContent: '',
    value: '',
    type: 'text',
    checked: false,
    isConnected: true,
    parentNode: null,
  };
  return el;
};
const root_mock = mockEl();
root_mock.id = 'app';
const formHost = mockEl();
formHost.id = 'ctx-form-host';
const topbarActions = mockEl();
topbarActions.id = 'topbar-actions';
const statusEl_mock = mockEl();
statusEl_mock.id = 'status';
const updatePill = mockEl();
updatePill.id = 'update-pill';
const atualizacaoSlot = mockEl();
atualizacaoSlot.id = 'atualizacao-slot';
const empty = mockEl();
const allEls = [root_mock, formHost, topbarActions, statusEl_mock, updatePill, atualizacaoSlot, empty];

globalThis.document = {
  getElementById: (id) => {
    const map = {
      'app': root_mock,
      'ctx-form-host': formHost,
      'topbar-actions': topbarActions,
      'status': statusEl_mock,
      'update-pill': updatePill,
      'atualizacao-slot': atualizacaoSlot,
    };
    return map[id] || null;
  },
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: () => mockEl(),
  body: mockEl(),
  documentElement: { setAttribute() {}, getAttribute: () => null },
  addEventListener() {},
  removeEventListener() {},
  title: '',
};
globalThis.window = globalThis;
globalThis.NL_APPDATA = '';
globalThis.NL_PATH = '';
globalThis.NL_PORT = 0;
globalThis.Neutralino = { init: () => {}, os: { getEnv: async () => '' }, filesystem: {}, events: { on: () => {} }, app: {} };
globalThis.toast = () => {};
globalThis.toastOk = () => {};
globalThis.toastErr = () => {};
globalThis.toastWarn = () => {};
globalThis.toastInfo = () => {};
globalThis.confirm = () => true;
globalThis.alert = () => {};
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.FormData = class { constructor() { this.data = {}; } get(k) { return this.data[k] || null; } entries() { return Object.entries(this.data); } };
globalThis.location = { reload() {}, href: '' };
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node-smoke' }, configurable: true }); } catch {}
globalThis.URL = class { static createObjectURL() { return ''; } static revokeObjectURL() {} };

const telas = [
  { nome: 'dashboard', importar: () => import('../src/js/app.js').then(m => m.renderDashboard ?? (() => {})) },
  { nome: 'cartoes', importar: () => import('../src/js/telas/cartoes.js').then(m => m.renderCartoes(1, api)) },
  { nome: 'faturas', importar: () => import('../src/js/telas/faturas.js').then(m => m.renderFaturas(1, api)) },
  { nome: 'custosFixos', importar: () => import('../src/js/telas/custosFixos.js').then(m => m.renderCustosFixos(1, api)) },
  { nome: 'parcelamentos', importar: () => import('../src/js/telas/parcelamentos.js').then(m => m.renderParcelamentos(1, api)) },
  { nome: 'relatorios', importar: () => import('../src/js/telas/relatorios.js').then(m => m.renderRelatorios(1, api)) },
  { nome: 'importacao', importar: () => import('../src/js/telas/importacao.js').then(m => m.renderImportacao(1, api)) },
  { nome: 'contextos', importar: () => import('../src/js/telas/contextos.js').then(m => m.renderContextos(1, api, () => {})) },
];

let erros = 0;
for (const tela of telas) {
  try {
    await tela.importar();
    console.log(`[OK] ${tela.nome}`);
  } catch (e) {
    console.log(`[X]  ${tela.nome}: ${e.message}`);
    if (e.stack) console.log(`     ${e.stack.split('\n').slice(0, 3).join('\n     ')}`);
    erros++;
  }
}
console.log(`\n=== ${erros} erro(s) ===`);
process.exit(erros > 0 ? 1 : 0);
