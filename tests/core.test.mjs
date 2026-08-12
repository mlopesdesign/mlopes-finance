import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarConta, criarContexto, validarData, validarValorCentavos } from '../src/js/backend/core/financeiro.js';
import { conciliarLancamento, criarLancamento, resumo } from '../src/js/backend/core/lancamentos.js';
import { abrirBancoLocal } from '../src/js/backend/ambiente.js';
import { getConfig, setConfig, getAllConfig, resetConfig } from '../src/js/backend/core/configuracoes.js';
import { migrar } from '../src/js/backend/migracoes.js';
import { criarBackup, radiografar, validarCiclo, restaurarBackup } from '../src/js/backend/core/backup.js';
import { criarCliente, listarClientes, atualizarCliente, criarFornecedor, criarProjeto, criarCentroCusto, criarTag, vincularTagLancamento } from '../src/js/backend/core/cadastros.js';
import { criarTransferencia, listarTransferencias } from '../src/js/backend/core/transferencias.js';
import { registrarBaixa, saldoEmAberto, listarBaixas } from '../src/js/backend/core/baixas.js';
import { criarRecorrencia, gerarProximaOcorrencia } from '../src/js/backend/core/recorrencias.js';
import { criarCartao, abrirFatura, pagarFatura, calcularCiclo, listarFaturas } from '../src/js/backend/core/cartoes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wasmPath = path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm');
const schemaPath = path.join(root, 'src/js/backend/schema.sql');

async function novoBanco() {
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = new SQL.Database();
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  migrar(db);
  return db;
}

test('núcleo cria contexto, conta, lançamento e resumo em centavos', async () => {
  const db = await novoBanco();
  const contextoId = criarContexto(db, { nome: 'Contexto de teste' });
  const contaId = criarConta(db, { contextoId, nome: 'Conta principal' });
  criarLancamento(db, { contextoId, contaId, natureza: 'receita', valorCentavos: 125000, dataCompetencia: '2026-08-11', descricao: 'Recebimento' });
  criarLancamento(db, { contextoId, contaId, natureza: 'despesa', valorCentavos: 30000, dataCompetencia: '2026-08-11', descricao: 'Despesa' });
  assert.deepEqual(resumo(db, contextoId), { receitas: 125000, despesas: 30000, saldo: 95000 });
  assert.equal(conciliarLancamento(db, 1), true);
  assert.equal(db.exec("SELECT status FROM lancamentos WHERE id = 1")[0].values[0][0], 'conciliado');
});

test('núcleo rejeita valor não positivo, data inválida e descrição vazia', async () => {
  const db = await novoBanco();
  const contextoId = criarContexto(db, { nome: 'Teste' });
  const contaId = criarConta(db, { contextoId, nome: 'Conta' });
  assert.throws(() => criarLancamento(db, { contextoId, contaId, natureza: 'receita', valorCentavos: 0, dataCompetencia: '2026-08-11', descricao: 'x' }));
  assert.throws(() => criarLancamento(db, { contextoId, contaId, natureza: 'receita', valorCentavos: 1, dataCompetencia: '11/08/2026', descricao: 'x' }));
  assert.throws(() => criarLancamento(db, { contextoId, contaId, natureza: 'receita', valorCentavos: 1, dataCompetencia: '2026-08-11', descricao: '' }));
});

test('persistência usa arquivo atual, temporário e recuperação', async () => {
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
  const temp = fs.mkdtempSync(path.join(root, '.tmp', 'persist-'));
  const real = { mkdir: async (p) => fs.mkdirSync(p, { recursive: true }), read: async (p) => fs.readFileSync(p), write: async (p, b) => fs.writeFileSync(p, Buffer.from(b)), remove: async (p) => fs.rmSync(p), move: async (a, b) => fs.renameSync(a, b) };
  globalThis.Neutralino = { events: { on: (_event, cb) => cb() }, os: { getEnv: async () => temp }, filesystem: { createDirectory: real.mkdir, readBinaryFile: real.read, writeBinaryFile: real.write, remove: real.remove, move: real.move } };
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const first = await abrirBancoLocal(SQL, fs.readFileSync(schemaPath, 'utf8'));
  first.db.run("INSERT INTO contextos_financeiros (nome) VALUES ('Persistido')");
  await first.persistir();
  assert.equal(fs.existsSync(path.join(temp, 'MLopesFinance/dados/mlopes-finance.sqlite')), true);
  const second = await abrirBancoLocal(SQL, fs.readFileSync(schemaPath, 'utf8'));
  assert.equal(second.db.exec('SELECT nome FROM contextos_financeiros')[0].values[0][0], 'Persistido');
  fs.rmSync(temp, { recursive: true, force: true });
});

test('configurações: get/set/getAll funcionam e persistem no DB', async () => {
  const db = await novoBanco();
  setConfig(db, 'tema', 'dark', 'texto');
  setConfig(db, 'marca_cor', '#ff00aa', 'cor');
  const all = getAllConfig(db);
  assert.equal(all.tema.valor, 'dark');
  assert.equal(all.marca_cor.valor, '#ff00aa');
  assert.equal(all.marca_cor.tipo, 'cor');
});

test('configurações: rejeita valor inválido para tema e cor fora de #RRGGBB', async () => {
  const db = await novoBanco();
  assert.throws(() => setConfig(db, 'tema', 'azul', 'texto'), /Valor inválido para tema/);
  assert.throws(() => setConfig(db, 'marca_cor', 'vermelhinho', 'cor'), /Cor inválida/);
  assert.throws(() => setConfig(db, 'marca_cor', '#FFF', 'cor'), /Cor inválida/);
});

test('configurações: reset volta aos defaults da migração v0.4.0', async () => {
  const db = await novoBanco();
  setConfig(db, 'tema', 'light', 'texto');
  setConfig(db, 'lixo_qualquer', 'x', 'texto');
  const all = resetConfig(db);
  assert.equal(all.tema.valor, 'dark');
  assert.equal(all.marca_cor.valor, '#155e6f');
  assert.equal(all.nome_exibicao.valor, 'MLopes Finance');
  assert.equal(getConfig(db, 'lixo_qualquer'), null);
});

test('backup: radiografar conta tabelas essenciais e validarCiclo preserva dados', async () => {
  const db = await novoBanco();
  const contextoId = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId, nome: 'X' });
  criarLancamento(db, { contextoId, contaId, natureza: 'receita', valorCentavos: 50000, dataCompetencia: '2026-08-11', descricao: 'R' });
  const radio = radiografar(db);
  assert.equal(radio.contextos_financeiros, 1);
  assert.equal(radio.contas, 1);
  assert.equal(radio.lancamentos, 1);
  const ciclo = validarCiclo(db);
  assert.equal(ciclo.tudoBate, true);
  assert.equal(ciclo.antes.contextos_financeiros, ciclo.depois.contextos_financeiros);
});

test('backup: restaurar preserva contagens após transação', async () => {
  const db = await novoBanco();
  const contextoId = criarContexto(db, { nome: 'Backup test' });
  const contaId = criarConta(db, { contextoId, nome: 'Conta B' });
  criarLancamento(db, { contextoId, contaId, natureza: 'despesa', valorCentavos: 10000, dataCompetencia: '2026-08-12', descricao: 'D' });
  const antes = radiografar(db);
  const backup = criarBackup(db);
  // Adiciona mais coisa
  criarLancamento(db, { contextoId, contaId, natureza: 'despesa', valorCentavos: 5000, dataCompetencia: '2026-08-12', descricao: 'D2' });
  assert.equal(radiografar(db).lancamentos, antes.lancamentos + 1);
  // Restaura
  restaurarBackup(db, backup);
  const depois = radiografar(db);
  assert.equal(depois.lancamentos, antes.lancamentos);
});

test('cadastros: CRUD clientes, fornecedores, projetos, centros_custo, tags', async () => {
  const db = await novoBanco();
  const contextoId = criarContexto(db, { nome: 'C' });
  const clienteId = criarCliente(db, { contextoId, nome: 'Acme', email: 'a@b.c' });
  const fornecedorId = criarFornecedor(db, { contextoId, nome: 'Fornecedor X' });
  const projetoId = criarProjeto(db, { contextoId, clienteId, nome: 'Proj 1' });
  const ccId = criarCentroCusto(db, { contextoId, nome: 'Marketing' });
  const tagId = criarTag(db, { contextoId, nome: 'urgente', cor: '#b42318' });
  assert.ok(clienteId > 0);
  assert.ok(fornecedorId > 0);
  assert.ok(projetoId > 0);
  assert.ok(ccId > 0);
  assert.ok(tagId > 0);
  // UNIQUE centro_custo
  assert.throws(() => criarCentroCusto(db, { contextoId, nome: 'Marketing' }));
  // Vincular tag a lançamento
  const contaId = criarConta(db, { contextoId, nome: 'X' });
  const lancId = criarLancamento(db, { contextoId, contaId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-11', descricao: 'L' });
  assert.equal(vincularTagLancamento(db, lancId, tagId), true);
  // Vincular de novo = falha silenciosa (PK composta)
  assert.equal(vincularTagLancamento(db, lancId, tagId), false);
  assert.equal(listarClientes(db, contextoId).length, 1);
});

test('transferências: cria débito + crédito vinculados, mesmo contexto, contas distintas', async () => {
  const db = await novoBanco();
  const contextoId = criarContexto(db, { nome: 'C' });
  const origem = criarConta(db, { contextoId, nome: 'Origem' });
  const destino = criarConta(db, { contextoId, nome: 'Destino' });
  const t = criarTransferencia(db, { contextoId, contaOrigemId: origem, contaDestinoId: destino, valorCentavos: 50000, dataCompetencia: '2026-08-11', descricao: 'Pix' });
  assert.ok(t.id > 0);
  assert.equal(t.idSaida, 1);
  assert.equal(t.idEntrada, 2);
  // Verifica que ambos os lançamentos foram marcados
  const l1 = db.exec('SELECT natureza, transferencia_id FROM lancamentos WHERE id = 1')[0].values[0];
  const l2 = db.exec('SELECT natureza, transferencia_id FROM lancamentos WHERE id = 2')[0].values[0];
  assert.equal(l1[0], 'despesa'); assert.equal(l1[1], t.id);
  assert.equal(l2[0], 'receita');  assert.equal(l2[1], t.id);
  // Rejeita: mesma conta
  assert.throws(() => criarTransferencia(db, { contextoId, contaOrigemId: origem, contaDestinoId: origem, valorCentavos: 100, dataCompetencia: '2026-08-11', descricao: 'X' }));
  // Lista
  assert.equal(listarTransferencias(db, contextoId).length, 1);
});

test('baixas: parcial e total, saldo consistente, excede é rejeitado', async () => {
  const db = await novoBanco();
  const contextoId = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId, nome: 'X' });
  const lId = criarLancamento(db, { contextoId, contaId, natureza: 'despesa', valorCentavos: 100000, dataCompetencia: '2026-08-11', descricao: 'D' });
  assert.equal(saldoEmAberto(db, lId), 100000);
  // Parcial
  registrarBaixa(db, { lancamentoId: lId, valorCentavos: 30000, dataBaixa: '2026-08-15', formaPagamento: 'pix' });
  assert.equal(saldoEmAberto(db, lId), 70000);
  // Status ainda aberto
  assert.equal(db.exec('SELECT status FROM lancamentos WHERE id = ?', [lId])[0].values[0][0], 'aberto');
  // Excede
  assert.throws(() => registrarBaixa(db, { lancamentoId: lId, valorCentavos: 80000, dataBaixa: '2026-08-20' }));
  // Quita
  registrarBaixa(db, { lancamentoId: lId, valorCentavos: 70000, dataBaixa: '2026-08-20' });
  assert.equal(saldoEmAberto(db, lId), 0);
  // Agora conciliado
  assert.equal(db.exec('SELECT status FROM lancamentos WHERE id = ?', [lId])[0].values[0][0], 'conciliado');
  assert.equal(listarBaixas(db, lId).length, 2);
});

test('recorrências: cria template e gera próxima ocorrência mensal', async () => {
  const db = await novoBanco();
  const contextoId = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId, nome: 'X' });
  const tplId = criarLancamento(db, { contextoId, contaId, natureza: 'despesa', valorCentavos: 9900, dataCompetencia: '2026-01-15', descricao: 'Netflix' });
  const rId = criarRecorrencia(db, { contextoId, lancamentoTemplateId: tplId, periodicidade: 'mensal', totalOcorrencias: 3 });
  const o1 = gerarProximaOcorrencia(db, rId, '2026-02-01T00:00:00Z');
  assert.equal(o1.data, '2026-02-15');
  assert.equal(db.exec('SELECT COUNT(*) FROM lancamentos WHERE descricao LIKE ?', [`%[rec ${rId}]%`])[0].values[0][0], 1);
  const o2 = gerarProximaOcorrencia(db, rId, '2026-03-01T00:00:00Z');
  assert.equal(o2.data, '2026-03-15');
  const o3 = gerarProximaOcorrencia(db, rId, '2026-04-01T00:00:00Z');
  assert.equal(o3.data, '2026-04-15');
  // 4ª deve ser null (atingiu totalOcorrencias=3)
  const o4 = gerarProximaOcorrencia(db, rId, '2026-05-01T00:00:00Z');
  assert.equal(o4, null);
});

test('cartões: cadastra, abre fatura, paga sem despesa duplicada', async () => {
  const db = await novoBanco();
  const contextoId = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId, nome: 'Conta pagto' });
  const cartaoId = criarCartao(db, { contextoId, nome: 'Nubank', limiteCentavos: 500000, diaFechamento: 5, diaVencimento: 15, contaPagamentoId: contaId });
  assert.ok(cartaoId > 0);
  // Ciclo
  assert.equal(calcularCiclo('2026-08-04', 5), '2026-08');  // dia 4 < fechamento 5 → ciclo 08
  assert.equal(calcularCiclo('2026-08-10', 5), '2026-09');  // dia 10 >= 5 → próximo ciclo
  // Abre fatura
  const faturaId = abrirFatura(db, { cartaoId, ciclo: '2026-08', dataFechamento: '2026-08-05', dataVencimento: '2026-08-15' });
  assert.ok(faturaId > 0);
  // Reabrir mesma fatura = mesmo id
  assert.equal(abrirFatura(db, { cartaoId, ciclo: '2026-08', dataFechamento: '2026-08-05', dataVencimento: '2026-08-15' }), faturaId);
  // Paga
  const pg = pagarFatura(db, { faturaId, contaPagamentoId: contaId, valorCentavos: 100000, dataPagamento: '2026-08-15' });
  assert.equal(pg.valorPago, 100000);
  // Status não é 'paga' porque valor_total é 0 (sem despesa na fatura ainda)
  assert.equal(listarFaturas(db, cartaoId).length, 1);
});

test('migração v2 → head: aplica todas as migrações em banco v0.4.1 simulado', async () => {
  // Simula um banco v0.4.1: so tem tabelas v1+v2
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = new SQL.Database();
  // Carrega só as tabelas v1+v2 (sem v3)
  db.exec(`CREATE TABLE meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
           INSERT INTO meta VALUES ('schema_version', '2');
           CREATE TABLE contextos_financeiros (id INTEGER PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '', ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
           CREATE TABLE contas (id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id), nome TEXT NOT NULL, tipo TEXT NOT NULL CHECK (tipo IN ('bancaria','cartao','investimento')), saldo_inicial_centavos INTEGER NOT NULL DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
           CREATE TABLE categorias (id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id), nome TEXT NOT NULL, natureza TEXT NOT NULL CHECK (natureza IN ('receita','despesa','ambas')), ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(contexto_id, nome));
           CREATE TABLE lancamentos (id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id), conta_id INTEGER NOT NULL REFERENCES contas(id), categoria_id INTEGER REFERENCES categorias(id), natureza TEXT NOT NULL CHECK (natureza IN ('receita','despesa')), valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0), data_competencia TEXT NOT NULL CHECK (data_competencia GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'), descricao TEXT NOT NULL, observacoes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK (status IN ('aberto','conciliado','estornado')), criado_em TEXT NOT NULL, atualizado_em TEXT);
           CREATE TABLE auditoria (id INTEGER PRIMARY KEY, entidade TEXT NOT NULL, entidade_id INTEGER NOT NULL, acao TEXT NOT NULL, dados_json TEXT NOT NULL, criado_em TEXT NOT NULL);
           CREATE TABLE configuracoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'texto', atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
           INSERT INTO configuracoes VALUES ('tema', 'dark', 'texto', CURRENT_TIMESTAMP);`);
  // Tabelas v3 NÃO devem existir ainda
  assert.throws(() => db.exec('SELECT * FROM clientes'));
  // Roda migração cumulativa (v2 → v3 → v4)
  const v = migrar(db);
  assert.equal(v, 4);
  // Agora tabelas v3 existem
  assert.equal(db.exec('SELECT COUNT(*) FROM clientes').length, 1);
  assert.equal(db.exec('SELECT COUNT(*) FROM transferencias').length, 1);
  assert.equal(db.exec('SELECT COUNT(*) FROM baixas').length, 1);
  assert.equal(db.exec('SELECT COUNT(*) FROM cartoes').length, 1);
  // Tabelas v4 também
  assert.equal(db.exec('SELECT COUNT(*) FROM importacoes').length, 1);
  assert.equal(db.exec('SELECT COUNT(*) FROM itens_importacao').length, 1);
  assert.equal(db.exec('SELECT COUNT(*) FROM anexos').length, 1);
  assert.equal(db.exec('SELECT COUNT(*) FROM conciliacoes').length, 1);
  // schema_version foi pra 4
  assert.equal(db.exec("SELECT valor FROM meta WHERE chave = 'schema_version'")[0].values[0][0], '4');
  // Dados anteriores preservados (configuracoes tema)
  assert.equal(db.exec("SELECT valor FROM configuracoes WHERE chave = 'tema'")[0].values[0][0], 'dark');
});
