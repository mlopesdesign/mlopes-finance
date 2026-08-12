import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarConta, criarContexto } from '../src/js/backend/core/financeiro.js';
import { conciliarLancamento, criarLancamento, resumo } from '../src/js/backend/core/lancamentos.js';
import { abrirBancoLocal } from '../src/js/backend/ambiente.js';
import { getConfig, setConfig, getAllConfig, resetConfig } from '../src/js/backend/core/configuracoes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('núcleo cria contexto, conta, lançamento e resumo em centavos', async () => {
  const SQL = await initSqlJs({ locateFile: () => path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm') }); const db = new SQL.Database(); db.exec(fs.readFileSync(path.join(root, 'src/js/backend/schema.sql'), 'utf8'));
  const contextoId = criarContexto(db, { nome: 'Contexto de teste' }); const contaId = criarConta(db, { contextoId, nome: 'Conta principal' });
  criarLancamento(db, { contextoId, contaId, natureza: 'receita', valorCentavos: 125000, dataCompetencia: '2026-08-11', descricao: 'Recebimento' });
  criarLancamento(db, { contextoId, contaId, natureza: 'despesa', valorCentavos: 30000, dataCompetencia: '2026-08-11', descricao: 'Despesa' });
  assert.deepEqual(resumo(db, contextoId), { receitas: 125000, despesas: 30000, saldo: 95000 }); assert.equal(conciliarLancamento(db, 1), true); assert.equal(db.exec("SELECT status FROM lancamentos WHERE id = 1")[0].values[0][0], 'conciliado');
});

test('núcleo rejeita valor não positivo, data inválida e descrição vazia', async () => {
  const SQL = await initSqlJs({ locateFile: () => path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm') }); const db = new SQL.Database(); db.exec(fs.readFileSync(path.join(root, 'src/js/backend/schema.sql'), 'utf8')); const contextoId = criarContexto(db, { nome: 'Teste' }); const contaId = criarConta(db, { contextoId, nome: 'Conta' });
  assert.throws(() => criarLancamento(db, { contextoId, contaId, natureza: 'receita', valorCentavos: 0, dataCompetencia: '2026-08-11', descricao: 'x' })); assert.throws(() => criarLancamento(db, { contextoId, contaId, natureza: 'receita', valorCentavos: 1, dataCompetencia: '11/08/2026', descricao: 'x' })); assert.throws(() => criarLancamento(db, { contextoId, contaId, natureza: 'receita', valorCentavos: 1, dataCompetencia: '2026-08-11', descricao: '' }));
});

test('persistência usa arquivo atual, temporário e recuperação', async () => {
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
  const temp = fs.mkdtempSync(path.join(root, '.tmp', 'persist-'));
  const real = { mkdir: async (p) => fs.mkdirSync(p, { recursive: true }), read: async (p) => fs.readFileSync(p), write: async (p, b) => fs.writeFileSync(p, Buffer.from(b)), remove: async (p) => fs.rmSync(p), move: async (a, b) => fs.renameSync(a, b) };
  globalThis.Neutralino = { events: { on: (_event, cb) => cb() }, os: { getEnv: async () => temp }, filesystem: { createDirectory: real.mkdir, readBinaryFile: real.read, writeBinaryFile: real.write, remove: real.remove, move: real.move } };
  const SQL = await initSqlJs({ locateFile: () => path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm') }); const first = await abrirBancoLocal(SQL, fs.readFileSync(path.join(root, 'src/js/backend/schema.sql'), 'utf8')); first.db.run("INSERT INTO contextos_financeiros (nome) VALUES ('Persistido')"); await first.persistir();
  assert.equal(fs.existsSync(path.join(temp, 'MLopesFinance/dados/mlopes-finance.sqlite')), true);
  const second = await abrirBancoLocal(SQL, fs.readFileSync(path.join(root, 'src/js/backend/schema.sql'), 'utf8')); assert.equal(second.db.exec('SELECT nome FROM contextos_financeiros')[0].values[0][0], 'Persistido'); fs.rmSync(temp, { recursive: true, force: true });
});

test('configurações: get/set/getAll funcionam e persistem no DB', async () => {
  const SQL = await initSqlJs({ locateFile: () => path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm') });
  const db = new SQL.Database();
  db.exec(fs.readFileSync(path.join(root, 'src/js/backend/schema.sql'), 'utf8'));
  setConfig(db, 'tema', 'dark', 'texto');
  setConfig(db, 'marca_cor', '#ff00aa', 'cor');
  const all = getAllConfig(db);
  assert.equal(all.tema.valor, 'dark');
  assert.equal(all.marca_cor.valor, '#ff00aa');
  assert.equal(all.marca_cor.tipo, 'cor');
  const c = getConfig(db, 'tema');
  assert.equal(c.valor, 'dark');
  assert.equal(c.tipo, 'texto');
});

test('configurações: rejeita valor inválido para tema e cor fora de #RRGGBB', async () => {
  const SQL = await initSqlJs({ locateFile: () => path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm') });
  const db = new SQL.Database();
  db.exec(fs.readFileSync(path.join(root, 'src/js/backend/schema.sql'), 'utf8'));
  assert.throws(() => setConfig(db, 'tema', 'azul', 'texto'), /Valor inválido para tema/);
  assert.throws(() => setConfig(db, 'marca_cor', 'vermelhinho', 'cor'), /Cor inválida/);
  assert.throws(() => setConfig(db, 'marca_cor', '#FFF', 'cor'), /Cor inválida/);
});

test('configurações: reset volta aos defaults da migração v0.4.0', async () => {
  const SQL = await initSqlJs({ locateFile: () => path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm') });
  const db = new SQL.Database();
  db.exec(fs.readFileSync(path.join(root, 'src/js/backend/schema.sql'), 'utf8'));
  setConfig(db, 'tema', 'light', 'texto');
  setConfig(db, 'lixo_qualquer', 'x', 'texto');
  const all = resetConfig(db);
  assert.equal(all.tema.valor, 'dark');
  assert.equal(all.marca_cor.valor, '#155e6f');
  assert.equal(all.nome_exibicao.valor, 'MLopes Finance');
  assert.equal(all.moeda.valor, 'BRL');
  assert.equal(getConfig(db, 'lixo_qualquer'), null);
});
