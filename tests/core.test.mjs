import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarConta, criarContexto, criarCategoria, validarData, validarValorCentavos } from '../src/js/backend/core/financeiro.js';
import { conciliarLancamento, criarLancamento, resumo } from '../src/js/backend/core/lancamentos.js';
import { abrirBancoLocal } from '../src/js/backend/ambiente.js';
import { getConfig, setConfig, getAllConfig, resetConfig } from '../src/js/backend/core/configuracoes.js';
import { migrar } from '../src/js/backend/migracoes.js';
import { criarBackup, radiografar, validarCiclo, restaurarBackup } from '../src/js/backend/core/backup.js';
import { criarCliente, listarClientes, atualizarCliente, criarFornecedor, criarProjeto, criarCentroCusto, criarTag, vincularTagLancamento } from '../src/js/backend/core/cadastros.js';
import { criarTransferencia, listarTransferencias } from '../src/js/backend/core/transferencias.js';
import { registrarBaixa, saldoEmAberto, listarBaixas } from '../src/js/backend/core/baixas.js';
import { criarRecorrencia, gerarProximaOcorrencia } from '../src/js/backend/core/recorrencias.js';
import { criarCartao, abrirFatura, pagarFatura, calcularCiclo, listarFaturas, atualizarCartao, excluirCartao, calcularCicloDaCompra, listarFaturasDetalhadas, listarLancamentosDaFatura } from '../src/js/backend/core/cartoes.js';
import { parsearOFX, parsearCSV, criarPreviaImportacao, confirmarImportacao, inferirNaturezaItem, listarImportacoes, cancelarImportacao, excluirImportacao, excluirLancamentosImportacao, reciclarImportacao } from '../src/js/backend/core/importacao.js';
import { balancete, comparativo, exportaCSV, calcularPeriodo } from '../src/js/backend/core/relatorios.js';
import { aplicarAtualizacao, pathCacheWebView2Async, invalidarCacheWebView2 } from '../src/js/backend/update.js';
import { excluirContexto, excluirConta, excluirCategoria } from '../src/js/backend/core/financeiro.js';
import { excluirCliente, excluirFornecedor, excluirProjeto, excluirCentroCusto, excluirTag, desvincularTagLancamento } from '../src/js/backend/core/cadastros.js';
import { excluirRecorrencia, desativarRecorrencia } from '../src/js/backend/core/recorrencias.js';
import { excluirTransferencia } from '../src/js/backend/core/transferencias.js';
import { excluirLancamento, excluirTodosLancamentos, estornarLancamento, editarLancamento, listarLancamentos, listarLancamentosDetalhados, obterLancamento } from '../src/js/backend/core/lancamentos.js';
import { resetarBanco } from '../src/js/backend/core/backup.js';

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
  // v0.9.0: criarCartao agora cria tambem a conta associada (tipo 'cartao') e retorna { cartaoId, contaId }
  const r = criarCartao(db, { contextoId, nome: 'Nubank', limiteCentavos: 500000, diaFechamento: 5, diaVencimento: 15, contaPagamentoId: contaId });
  assert.ok(r.cartaoId > 0);
  assert.ok(r.contaId > 0);
  const cartaoId = r.cartaoId;
  // A conta associada existe e e' tipo 'cartao'
  const tipoContaAssoc = db.exec('SELECT tipo FROM contas WHERE id = ?', [r.contaId])[0]?.values?.[0]?.[0];
  assert.equal(tipoContaAssoc, 'cartao');
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
  // v0.9.0: o lancamento de pagamento foi marcado com fatura_id
  const lancPagFatura = db.exec('SELECT fatura_id FROM lancamentos WHERE id = ?', [pg.lancamentoId])[0]?.values?.[0]?.[0];
  assert.equal(lancPagFatura, faturaId);
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
  // Roda migração cumulativa (v2 → v3 → v4 → v5 → v6)
  const v = migrar(db);
  assert.equal(v, 6, 'migracao cumulativa foi ate v6 (v0.9.0)');
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
  // v0.9.0: colunas novas em cartoes e lancamentos
  const colsCartao = db.exec("PRAGMA table_info(cartoes)")[0].values.map(r => r[1]);
  assert.ok(colsCartao.includes('conta_associada_id'), 'cartao.conta_associada_id existe (v0.9.0)');
  const colsLanc = db.exec("PRAGMA table_info(lancamentos)")[0].values.map(r => r[1]);
  assert.ok(colsLanc.includes('cartao_id'), 'lancamento.cartao_id existe (v0.9.0)');
  assert.ok(colsLanc.includes('fatura_id'), 'lancamento.fatura_id existe (v0.9.0)');
  // schema_version foi pra 6
  assert.equal(db.exec("SELECT valor FROM meta WHERE chave = 'schema_version'")[0].values[0][0], '6');
  // Dados anteriores preservados (configuracoes tema)
  assert.equal(db.exec("SELECT valor FROM configuracoes WHERE chave = 'tema'")[0].values[0][0], 'dark');
});

test('importacao: parsearOFX basico extrai transacoes com chave externa', async () => {
  const ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:NO_SPECIAL_CHARS
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE
<STMTTRN>
TRNTYPE:DEBIT
DTPOSTED:20260810120000
TRNAMT:-150.50
FITID:20260810001
NAME:IFOOD
MEMO:lanche
</STMTTRN>
<STMTTRN>
TRNTYPE:CREDIT
DTPOSTED:20260811120000
TRNAMT:3500.00
FITID:20260811002
NAME:SALARIO
</STMTTRN>`;
  const txs = parsearOFX(ofx);
  assert.equal(txs.length, 2);
  assert.equal(txs[0].data_transacao, '2026-08-10');
  // Preserva sinal: -150.50 = -15050 centavos (despesa)
  assert.equal(txs[0].valor_centavos, -15050);
  assert.equal(txs[0].descricao, 'IFOOD');
  assert.equal(txs[0].natureza_sugerida, 'despesa');
  assert.ok(txs[0].chave_externa.length > 0);
  assert.equal(txs[1].data_transacao, '2026-08-11');
  // Positivo: 3500.00 = 350000 centavos (receita)
  assert.equal(txs[1].valor_centavos, 350000);
  assert.equal(txs[1].descricao, 'SALARIO');
  assert.equal(txs[1].natureza_sugerida, 'receita');
  // Chaves devem ser diferentes
  assert.notEqual(txs[0].chave_externa, txs[1].chave_externa);
});

test('importacao: parsearCSV com virgula e ponto-e-virgula', async () => {
  // CSV virgula com valor decimal (sem virgula, senao nao cabe)
  const csvVirgula = `data,valor,descricao\n2026-08-10,150.50,Compra A\n2026-08-11,89.90,Compra B`;
  const txs1 = parsearCSV(csvVirgula);
  assert.equal(txs1.length, 2);
  assert.equal(txs1[0].valor_centavos, 15050);
  assert.equal(txs1[0].descricao, 'Compra A');
  assert.equal(txs1[1].valor_centavos, 8990);
  // natureza_sugerida: positivo = receita
  assert.equal(txs1[0].natureza_sugerida, 'receita');
  assert.equal(txs1[1].natureza_sugerida, 'receita');

  // CSV com ponto-e-virgula (formato BR/PT) e data dd/mm/yyyy
  const csvPontoVirgula = `data;valor;descricao\n10/08/2026;-200,00;Padaria\n11/08/2026;1500,00;Salario`;
  const txs2 = parsearCSV(csvPontoVirgula);
  assert.equal(txs2.length, 2);
  assert.equal(txs2[0].data_transacao, '2026-08-10');
  // Preserva sinal: negativo = despesa
  assert.equal(txs2[0].valor_centavos, -20000);
  assert.equal(txs2[0].descricao, 'Padaria');
  assert.equal(txs2[0].natureza_sugerida, 'despesa');
  // Positivo = receita
  assert.equal(txs2[1].data_transacao, '2026-08-11');
  assert.equal(txs2[1].valor_centavos, 150000);
  assert.equal(txs2[1].natureza_sugerida, 'receita');
});

test('importacao: criarPreviaImportacao detecta duplicado contra mesmo arquivo', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta', tipo: 'bancaria' });
  const conteudo = `OFXHEADER:100\nDATA:OFXSGML\n<STMTTRN>\nTRNTYPE:DEBIT\nDTPOSTED:20260810\nTRNAMT:-100.00\nFITID:F1\nNAME:X\n</STMTTRN>`;
  const id1 = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.ofx', formato: 'ofx', conteudo });
  assert.ok(Number.isInteger(id1));
  // Confirmar
  const out1 = confirmarImportacao(db, { importacaoId: id1, contaId });
  assert.equal(out1.importados, 1);
  // Tentar recriar o mesmo arquivo deve dar erro
  assert.throws(
    () => criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.ofx', formato: 'ofx', conteudo }),
    /ja tem uma importacao/
  );
});

test('importacao: confirmarImportacao cria lancamentos e bloquear duplicata contra lancamentos existentes', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'C1', tipo: 'bancaria' });
  // Lancamento pre-existente
  criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 5000, dataCompetencia: '2026-08-10', descricao: 'Cafe' });
  // Importar OFX com 1 item identico + 1 novo
  const ofx = `<STMTTRN>\nTRNTYPE:DEBIT\nDTPOSTED:20260810\nTRNAMT:-50.00\nFITID:A1\nNAME:Cafe\n</STMTTRN>\n<STMTTRN>\nTRNTYPE:DEBIT\nDTPOSTED:20260811\nTRNAMT:-30.00\nFITID:A2\nNAME:Almoco\n</STMTTRN>`;
  const id = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'x.ofx', formato: 'ofx', conteudo: ofx });
  const itens = db.exec('SELECT id, status FROM itens_importacao WHERE importacao_id = ? ORDER BY id', [id])[0]?.values ?? [];
  assert.equal(itens.length, 2);
  // Item 1 (Cafe, ja existe) -> duplicado
  assert.equal(itens[0][1], 'duplicado');
  // Item 2 (Almoco, novo) -> pendente
  assert.equal(itens[1][1], 'pendente');
  // Confirmar: só 1 lancamento criado
  const out = confirmarImportacao(db, { importacaoId: id, contaId });
  assert.equal(out.importados, 1);
  const total = db.exec('SELECT COUNT(*) FROM lancamentos WHERE contexto_id = ?', [cid])[0]?.values?.[0]?.[0];
  assert.equal(total, 2); // 1 pre-existente + 1 importado
  const status = db.exec("SELECT status FROM importacoes WHERE id = ?", [id])[0]?.values?.[0]?.[0];
  assert.equal(status, 'confirmada');
});

test('importacao: cancelarImportacao marca pendentes como ignorados', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const ofx = `<STMTTRN>\nTRNTYPE:DEBIT\nDTPOSTED:20260810\nTRNAMT:-10.00\nFITID:C1\nNAME:X\n</STMTTRN>`;
  const id = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'c.ofx', formato: 'ofx', conteudo: ofx });
  assert.ok(id);
  const r = cancelarImportacao(db, id);
  assert.equal(r, true);
  const itemStatus = db.exec("SELECT status FROM itens_importacao WHERE importacao_id = ?", [id])[0]?.values?.[0]?.[0];
  assert.equal(itemStatus, 'ignorado');
  const impStatus = db.exec("SELECT status FROM importacoes WHERE id = ?", [id])[0]?.values?.[0]?.[0];
  assert.equal(impStatus, 'cancelada');
  const lista = listarImportacoes(db, cid);
  assert.equal(lista.length, 1);
  assert.equal(lista[0][7], 'cancelada'); // coluna status
});

test('importacao: excluirImportacao remove a importacao (cascade nos itens) e mantem lancamentos', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'X', tipo: 'bancaria' });
  const ofx = `<STMTTRN>\nTRNTYPE:DEBIT\nDTPOSTED:20260810\nTRNAMT:-100.00\nFITID:E1\nNAME:L1\n</STMTTRN>\n<STMTTRN>\nTRNTYPE:CREDIT\nDTPOSTED:20260811\nTRNAMT:50.00\nFITID:E2\nNAME:L2\n</STMTTRN>`;
  const id = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'e.ofx', formato: 'ofx', conteudo: ofx });
  const out = confirmarImportacao(db, { importacaoId: id, contaId });
  assert.equal(out.importados, 2);
  // Antes: 2 lancamentos
  assert.equal(db.exec('SELECT COUNT(*) FROM lancamentos WHERE contexto_id = ?', [cid])[0]?.values?.[0]?.[0], 2);
  // Excluir a importacao
  const r = excluirImportacao(db, id);
  assert.equal(r.ok, true);
  assert.equal(r.statusAnterior, 'confirmada');
  // Importacao removida
  assert.equal(db.exec('SELECT id FROM importacoes WHERE id = ?', [id]).length, 0);
  // Itens removidos (cascade)
  const itensRestantes = db.exec('SELECT id FROM itens_importacao WHERE importacao_id = ?', [id])[0]?.values?.length ?? 0;
  assert.equal(itensRestantes, 0);
  // Lancamentos permanecem intactos
  assert.equal(db.exec('SELECT COUNT(*) FROM lancamentos WHERE contexto_id = ?', [cid])[0]?.values?.[0]?.[0], 2);
  // Listar importacoes: vazio
  assert.equal(listarImportacoes(db, cid).length, 0);
  // Reimportar o mesmo arquivo (mesmo hash) agora DEVE funcionar porque a importacao antiga foi removida
  const id2 = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'e.ofx', formato: 'ofx', conteudo: ofx });
  assert.ok(id2);
  // Mas os 2 itens vao ser duplicados contra os 2 lancamentos ja existentes
  const itensNovos = db.exec('SELECT status FROM itens_importacao WHERE importacao_id = ?', [id2])[0]?.values ?? [];
  assert.equal(itensNovos.length, 2);
  assert.equal(itensNovos.every((i) => i[0] === 'duplicado'), true);
});

test('importacao: excluirImportacao rejeita id invalido', async () => {
  const db = await novoBanco();
  assert.throws(() => excluirImportacao(db, 'abc'), /obrigatorio/);
  assert.throws(() => excluirImportacao(db, 99999), /nao encontrada/);
});

test('importacao: CSV com sinal cria lancamentos com natureza correta (despesa/receita)', async () => {
  // Bug v0.8.8: parsearCSV fazia Math.abs(valor) e o sinal se perdia.
  // Resultado: tudo virava 'despesa' (padraoNatureza default).
  // Fix: sinal preservado em valor_centavos (negativo=despesa, positivo=receita).
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Banco', tipo: 'bancaria' });
  // CSV do extrato real: tem despesas (negativo) E receitas (positivo)
  const csv = `data;descricao;valor
10/01/2026;PIX ENVIADO - MERCADO;-150,50
11/01/2026;PIX RECEBIDO - CLIENTE;1500,00
12/01/2026;DEBITO COMBUSTIVEL;-250,00
13/01/2026;SALARIO;5000,00`;
  const id = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'exemplo.csv', formato: 'csv', conteudo: csv });
  const out = confirmarImportacao(db, { importacaoId: id, contaId });
  assert.equal(out.importados, 4);
  // Verifica natureza de cada lancamento
  const lancs = db.exec('SELECT id, natureza, valor_centavos, descricao FROM lancamentos WHERE contexto_id = ? ORDER BY data_competencia', [cid])[0]?.values ?? [];
  assert.equal(lancs.length, 4);
  // Despesas
  assert.equal(lancs[0][1], 'despesa');
  assert.equal(lancs[0][2], 15050);
  assert.equal(lancs[2][1], 'despesa');
  assert.equal(lancs[2][2], 25000);
  // Receitas
  assert.equal(lancs[1][1], 'receita');
  assert.equal(lancs[1][2], 150000);
  assert.equal(lancs[3][1], 'receita');
  assert.equal(lancs[3][2], 500000);
});

test('importacao: excluirLancamentosImportacao remove todos os lancamentos nao conciliados', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'X', tipo: 'bancaria' });
  const ofx = `<STMTTRN>\nTRNTYPE:DEBIT\nDTPOSTED:20260810\nTRNAMT:-100.00\nFITID:X1\nNAME:L1\n</STMTTRN>\n<STMTTRN>\nTRNTYPE:CREDIT\nDTPOSTED:20260811\nTRNAMT:50.00\nFITID:X2\nNAME:L2\n</STMTTRN>`;
  const id = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'x.ofx', formato: 'ofx', conteudo: ofx });
  const out = confirmarImportacao(db, { importacaoId: id, contaId });
  assert.equal(out.importados, 2);
  // Antes: 2 lancamentos
  assert.equal(db.exec('SELECT COUNT(*) FROM lancamentos WHERE contexto_id = ?', [cid])[0]?.values?.[0]?.[0], 2);
  // Excluir
  const r = excluirLancamentosImportacao(db, id);
  assert.equal(r.ok, true);
  assert.equal(r.excluidos, 2);
  assert.equal(r.bloqueadoPor, null);
  // Lancamentos removidos
  assert.equal(db.exec('SELECT COUNT(*) FROM lancamentos WHERE contexto_id = ?', [cid])[0]?.values?.[0]?.[0], 0);
  // Importacao marcada como cancelada
  const impStatus = db.exec("SELECT status FROM importacoes WHERE id = ?", [id])[0]?.values?.[0]?.[0];
  assert.equal(impStatus, 'cancelada');
  // Itens: lancamento_id = NULL, status = 'ignorado'
  const itens = db.exec('SELECT status, lancamento_id FROM itens_importacao WHERE importacao_id = ?', [id])[0]?.values ?? [];
  for (const it of itens) {
    assert.equal(it[0], 'ignorado');
    assert.equal(it[1], null);
  }
});

test('importacao: excluirLancamentosImportacao BLOQUEIA se algum lancamento estiver conciliado', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'X', tipo: 'bancaria' });
  const ofx = `<STMTTRN>\nTRNTYPE:DEBIT\nDTPOSTED:20260810\nTRNAMT:-100.00\nFITID:Y1\nNAME:L1\n</STMTTRN>\n<STMTTRN>\nTRNTYPE:DEBIT\nDTPOSTED:20260811\nTRNAMT:-50.00\nFITID:Y2\nNAME:L2\n</STMTTRN>`;
  const id = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'y.ofx', formato: 'ofx', conteudo: ofx });
  confirmarImportacao(db, { importacaoId: id, contaId });
  // Conciliar o primeiro lancamento
  const lancs = db.exec('SELECT id FROM lancamentos WHERE contexto_id = ?', [cid])[0]?.values ?? [];
  conciliarLancamento(db, lancs[0][0]);
  // Tentar excluir
  const r = excluirLancamentosImportacao(db, id);
  assert.equal(r.ok, false);
  assert.equal(r.bloqueadoPor, 'conciliado');
  assert.equal(r.excluidos, 0);
  assert.ok(r.mensagem.includes('conciliad'));
  // Lancamentos permanecem
  assert.equal(db.exec('SELECT COUNT(*) FROM lancamentos WHERE contexto_id = ?', [cid])[0]?.values?.[0]?.[0], 2);
});

test('importacao: excluirLancamentosImportacao em importacao sem lancamentos vinculados', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const ofx = `<STMTTRN>\nTRNTYPE:DEBIT\nDTPOSTED:20260810\nTRNAMT:-100.00\nFITID:Z1\nNAME:L1\n</STMTTRN>`;
  const id = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'z.ofx', formato: 'ofx', conteudo: ofx });
  // Sem confirmar (nenhum lancamento criado)
  const r = excluirLancamentosImportacao(db, id);
  assert.equal(r.ok, true);
  assert.equal(r.excluidos, 0);
  assert.match(r.mensagem, /Nenhum lancamento/);
});

test('relatorios: balancete basico agrupa por categoria e soma certo', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta', tipo: 'bancaria' });
  const catR = criarCategoria(db, { contextoId: cid, nome: 'Salario', natureza: 'receita' });
  const catD = criarCategoria(db, { contextoId: cid, nome: 'Mercado', natureza: 'despesa' });
  criarLancamento(db, { contextoId: cid, contaId, categoriaId: catR, natureza: 'receita', valorCentavos: 500000, dataCompetencia: '2026-08-05', descricao: 'Salario' });
  criarLancamento(db, { contextoId: cid, contaId, categoriaId: catR, natureza: 'receita', valorCentavos: 100000, dataCompetencia: '2026-08-15', descricao: 'Extra' });
  criarLancamento(db, { contextoId: cid, contaId, categoriaId: catD, natureza: 'despesa', valorCentavos: 35000, dataCompetencia: '2026-08-10', descricao: 'Supermercado' });
  criarLancamento(db, { contextoId: cid, contaId, categoriaId: catD, natureza: 'despesa', valorCentavos: 12000, dataCompetencia: '2026-08-12', descricao: 'Padaria' });

  const blc = balancete(db, { contextoId: cid, dataInicio: '2026-08-01', dataFim: '2026-08-31', agrupamento: 'categoria' });
  assert.equal(blc.linhas.length, 2);
  const sal = blc.linhas.find(l => l.grupo === 'Salario');
  const mer = blc.linhas.find(l => l.grupo === 'Mercado');
  assert.equal(sal.totalReceitas, 600000);
  assert.equal(sal.lancamentos, 2);
  assert.equal(mer.totalDespesas, 47000);
  assert.equal(mer.lancamentos, 2);
  assert.equal(blc.totais.totalReceitas, 600000);
  assert.equal(blc.totais.totalDespesas, 47000);
  assert.equal(blc.totais.saldo, 553000);
  assert.equal(blc.totais.lancamentos, 4);
});

test('relatorios: balancete filtra por periodo (ignora fora do intervalo)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta', tipo: 'bancaria' });
  const cat = criarCategoria(db, { contextoId: cid, nome: 'Geral', natureza: 'despesa' });
  criarLancamento(db, { contextoId: cid, contaId, categoriaId: cat, natureza: 'despesa', valorCentavos: 1000, dataCompetencia: '2026-07-15', descricao: 'Antes' });
  criarLancamento(db, { contextoId: cid, contaId, categoriaId: cat, natureza: 'despesa', valorCentavos: 2000, dataCompetencia: '2026-08-15', descricao: 'Dentro' });
  criarLancamento(db, { contextoId: cid, contaId, categoriaId: cat, natureza: 'despesa', valorCentavos: 3000, dataCompetencia: '2026-09-15', descricao: 'Depois' });
  const blc = balancete(db, { contextoId: cid, dataInicio: '2026-08-01', dataFim: '2026-08-31', agrupamento: 'categoria' });
  assert.equal(blc.totais.lancamentos, 1);
  assert.equal(blc.totais.totalDespesas, 2000);
});

test('relatorios: balancete vazio retorna totais zerados', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const blc = balancete(db, { contextoId: cid, dataInicio: '2026-01-01', dataFim: '2026-01-31', agrupamento: 'categoria' });
  assert.equal(blc.linhas.length, 0);
  assert.equal(blc.totais.totalReceitas, 0);
  assert.equal(blc.totais.totalDespesas, 0);
  assert.equal(blc.totais.saldo, 0);
  assert.equal(blc.totais.lancamentos, 0);
});

test('relatorios: balancete agrupa por tag (N:N) com SEM_TAG pra lancamentos sem', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'C', tipo: 'bancaria' });
  const cat = criarCategoria(db, { contextoId: cid, nome: 'Geral', natureza: 'despesa' });
  const tagUrg = criarTag(db, { contextoId: cid, nome: 'Urgente' });
  const tagViag = criarTag(db, { contextoId: cid, nome: 'Viagem' });
  const l1 = criarLancamento(db, { contextoId: cid, contaId, categoriaId: cat, natureza: 'despesa', valorCentavos: 1000, dataCompetencia: '2026-08-10', descricao: 'A' });
  const l2 = criarLancamento(db, { contextoId: cid, contaId, categoriaId: cat, natureza: 'despesa', valorCentavos: 2000, dataCompetencia: '2026-08-11', descricao: 'B' });
  vincularTagLancamento(db, l1, tagUrg);
  vincularTagLancamento(db, l2, tagViag);
  const blc = balancete(db, { contextoId: cid, dataInicio: '2026-08-01', dataFim: '2026-08-31', agrupamento: 'tag' });
  assert.equal(blc.linhas.length, 2);
  const urg = blc.linhas.find(l => l.grupo === 'Urgente');
  const viag = blc.linhas.find(l => l.grupo === 'Viagem');
  assert.equal(urg.totalDespesas, 1000);
  assert.equal(viag.totalDespesas, 2000);
});

test('relatorios: comparativo mensal retorna atual + anterior + delta', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'C', tipo: 'bancaria' });
  const cat = criarCategoria(db, { contextoId: cid, nome: 'Geral', natureza: 'receita' });
  // Marco 2026: 1000
  criarLancamento(db, { contextoId: cid, contaId, categoriaId: cat, natureza: 'receita', valorCentavos: 100000, dataCompetencia: '2026-03-15', descricao: 'M' });
  // Abril 2026: 2000
  criarLancamento(db, { contextoId: cid, contaId, categoriaId: cat, natureza: 'receita', valorCentavos: 200000, dataCompetencia: '2026-04-15', descricao: 'A' });

  // Forco o periodo custom pra testar
  const out = comparativo(db, {
    contextoId: cid,
    tipo: 'custom',
    customInicio: '2026-04-01',
    customFim: '2026-04-30',
    agrupamento: 'categoria',
  });
  assert.equal(out.atual.totais.totalReceitas, 200000);
  assert.equal(out.anterior.totais.totalReceitas, 100000);
  assert.equal(out.delta.totalReceitas, 100000); // 2000 - 1000
  assert.equal(out.delta.saldo, 100000);
});

test('relatorios: calcularPeriodo custom gera anterior com mesma duracao', () => {
  const p = calcularPeriodo('custom', '2026-04-15', '2026-04-25');
  assert.equal(p.inicio.toISOString().slice(0, 10), '2026-04-15');
  assert.equal(p.fim.toISOString().slice(0, 10), '2026-04-25');
  // Periodo anterior: 11 dias, terminando em 2026-04-14
  assert.equal(p.anterior.fim.toISOString().slice(0, 10), '2026-04-14');
  assert.equal(p.anterior.inicio.toISOString().slice(0, 10), '2026-04-04');
});

test('relatorios: exportaCSV gera header + linhas + total + escapa virgula/aspas', () => {
  const blc = {
    contextoId: 1,
    dataInicio: '2026-08-01',
    dataFim: '2026-08-31',
    agrupamento: 'categoria',
    linhas: [
      { grupo: 'Salario', totalReceitas: 500000, totalDespesas: 0, saldo: 500000, lancamentos: 1 },
      { grupo: 'Mercado, "extra"', totalReceitas: 0, totalDespesas: 12345, saldo: -12345, lancamentos: 2 },
    ],
    totais: { totalReceitas: 500000, totalDespesas: 12345, saldo: 487655, lancamentos: 3 },
  };
  const csv = exportaCSV(blc);
  // Header presente
  assert.match(csv, /Grupo;Receitas \(R\$\);Despesas \(R\$\);Saldo \(R\$\);Lancamentos/);
  // Meta info
  assert.match(csv, /# Periodo: 2026-08-01 a 2026-08-31/);
  // Linha escapada com virgula e aspas
  assert.match(csv, /"Mercado, ""extra"""/);
  // Total
  assert.match(csv, /^TOTAL;/m);
});

test('relatorios: balancete valida agrupamento invalido', () => {
  // Sync test (sem novoBanco)
  return (async () => {
    const db = await novoBanco();
    const cid = criarContexto(db, { nome: 'C' });
    assert.throws(
      () => balancete(db, { contextoId: cid, dataInicio: '2026-08-01', dataFim: '2026-08-31', agrupamento: 'invalido' }),
      /Agrupamento invalido/
    );
  })();
});
import { compararVersao, extrairTagVersion, escolherAsset, renderizarMarkdownSimples } from '../src/js/backend/core/update.js';

test('update: compararVersao identifica maior/menor/igual', () => {
  assert.equal(compararVersao('0.7.0', '0.7.0'), 0);
  assert.equal(compararVersao('0.7.0', '0.7.1'), -1);
  assert.equal(compararVersao('0.7.1', '0.7.0'), 1);
  assert.equal(compararVersao('0.10.0', '0.9.0'), 1);
  assert.equal(compararVersao('1.0.0', '0.99.99'), 1);
  assert.equal(compararVersao('v0.8.0', '0.7.0'), 1); // strip 'v'
  assert.equal(compararVersao('0.7.0', 'v0.8.0'), -1);
  assert.equal(compararVersao('0.7.0', '0.7.0-rc1'), 0); // ignora sufixo
});

test('update: extrairTagVersion remove prefixo v', () => {
  assert.equal(extrairTagVersion('v0.7.0'), '0.7.0');
  assert.equal(extrairTagVersion('0.7.0'), '0.7.0');
  assert.equal(extrairTagVersion('V1.2.3'), '1.2.3');
  assert.equal(extrairTagVersion(null), null);
  assert.equal(extrairTagVersion(''), null);
  assert.equal(extrairTagVersion(undefined), null);
});

test('update: escolherAsset acha asset por nome exato', () => {
  const release = {
    tag_name: 'v0.8.8',
    assets: [
      { name: 'Setup.exe', browser_download_url: 'https://x/Setup.exe', size: 10_000_000 },
      { name: 'resources.neu', browser_download_url: 'https://x/resources.neu', size: 5_600_000 },
    ],
  };
  const r = escolherAsset(release, 'resources.neu');
  assert.ok(r);
  assert.equal(r.tagName, 'v0.8.8');
  assert.equal(r.asset.name, 'resources.neu');
  assert.equal(r.asset.size, 5_600_000);
  // Nao acha
  assert.equal(escolherAsset(release, 'instalador.exe'), null);
  // Sem assets
  assert.equal(escolherAsset({ tag_name: 'v0.8.8' }, 'resources.neu'), null);
  // Release null
  assert.equal(escolherAsset(null, 'resources.neu'), null);
});

test('update: renderizarMarkdownSimples escapa HTML e converte estrutura basica', () => {
  const md = `# O que mudou
- Etiqueta amarela no balao com o numero de mensagens
- Aviso rapido com som

## Detalhes
Texto simples com **negrito** e *italico* e \`codigo\`.

[link](https://exemplo.com)
`;
  const html = renderizarMarkdownSimples(md);
  // titulos (h1 -> h2, h2 -> h3 conforme regra de nivel+1)
  assert.match(html, /<h2>O que mudou<\/h2>/);
  assert.match(html, /<h3>Detalhes<\/h3>/);
  // lista
  assert.match(html, /<ul>[\s\S]*<li>Etiqueta amarela/);
  assert.match(html, /<li>Aviso rapido com som<\/li>/);
  assert.match(html, /<\/ul>/);
  // inline
  assert.match(html, /<strong>negrito<\/strong>/);
  assert.match(html, /<em>italico<\/em>/);
  assert.match(html, /<code>codigo<\/code>/);
  // link com rel=noopener
  assert.match(html, /<a href="https:\/\/exemplo\.com" rel="noopener noreferrer" target="_blank">link<\/a>/);
  // XSS: <script> deve virar &lt;script&gt;
  const xss = renderizarMarkdownSimples('<script>alert(1)</script>');
  assert.match(xss, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  // Vazio / null
  assert.equal(renderizarMarkdownSimples(''), '');
  assert.equal(renderizarMarkdownSimples(null), '');
});
import { listarContextos, obterContexto, atualizarContexto, alternarContextoAtivo, resumoContexto } from '../src/js/backend/core/financeiro.js';

test('contextos: criarContexto gera seed de categoria Transferencia', async () => {
  const db = await novoBanco();
  const id = criarContexto(db, { nome: 'ML Lopes Design' });
  assert.equal(typeof id, 'number');
  const cats = db.exec('SELECT nome, natureza FROM categorias WHERE contexto_id = ?', [id])[0]?.values ?? [];
  assert.equal(cats.length, 1);
  assert.equal(cats[0][0], 'Transferência interna');
  assert.equal(cats[0][1], 'ambas');
});

test('contextos: listarContextos retorna apenas ativos por default', async () => {
  const db = await novoBanco();
  const id1 = criarContexto(db, { nome: 'Ativo 1' });
  const id2 = criarContexto(db, { nome: 'Ativo 2' });
  const id3 = criarContexto(db, { nome: 'Inativo' });
  alternarContextoAtivo(db, id3); // desativa
  const ativos = listarContextos(db, false);
  assert.equal(ativos.length, 2);
  const todos = listarContextos(db, true);
  assert.equal(todos.length, 3);
  const nomes = ativos.map(r => r[1]).sort();
  assert.deepEqual(nomes, ['Ativo 1', 'Ativo 2']);
});

test('contextos: atualizarContexto muda nome e descricao', async () => {
  const db = await novoBanco();
  const id = criarContexto(db, { nome: 'Original', descricao: 'desc' });
  atualizarContexto(db, { id, nome: 'Novo nome', descricao: 'nova desc' });
  const ctx = obterContexto(db, id);
  assert.equal(ctx[1], 'Novo nome');
  assert.equal(ctx[2], 'nova desc');
});

test('contextos: alternarContextoAtivo alterna ativo e preserva dados', async () => {
  const db = await novoBanco();
  const id = criarContexto(db, { nome: 'Teste' });
  const ctx0 = obterContexto(db, id);
  assert.equal(ctx0[3], 1); // ativo
  const result1 = alternarContextoAtivo(db, id);
  assert.equal(result1, false);
  assert.equal(obterContexto(db, id)[3], 0);
  const result2 = alternarContextoAtivo(db, id);
  assert.equal(result2, true);
  assert.equal(obterContexto(db, id)[3], 1);
});

test('contextos: resumoContexto agrega receitas/despesas/contas', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'PJ' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Banco', tipo: 'bancaria' });
  const cat = criarCategoria(db, { contextoId: cid, nome: 'Vendas', natureza: 'receita' });
  criarLancamento(db, { contextoId: cid, contaId, categoriaId: cat, natureza: 'receita', valorCentavos: 100000, dataCompetencia: '2026-08-01', descricao: 'A' });
  criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 30000, dataCompetencia: '2026-08-02', descricao: 'B' });
  const r = resumoContexto(db, cid);
  assert.equal(r.receitas, 100000);
  assert.equal(r.despesas, 30000);
  assert.equal(r.saldo, 70000);
  assert.equal(r.lancamentos, 2);
  assert.equal(r.contas, 1);
});

// ============================================================================
// update (auto-update): invalida cache do WebView2 antes do restartProcess
// ============================================================================
// Bug do loop (v0.8.13): o `Neutralino.app.restartProcess()` reinicia o
// binario mas NAO invalida o cache HTTP do WebView2 em
// %APPDATA%\\MLopesFinance.exe\\EBWebView. O Chromium serve o app.js
// antigo do disco e o app continua mostrando a versao anterior
// (loop de "tem atualizacao"). Estes testes fixam o contrato:
//   1. pathCacheWebView2Async retorna o path certo
//   2. invalidarCacheWebView2 faz rd /S /Q nos 3 alvos
//   3. aplicarAtualizacao chama invalidarCacheWebView2 ANTES do restartProcess

test('update: pathCacheWebView2Async retorna <APPDATA>\\MLopesFinance.exe\\EBWebView', async () => {
  const original = globalThis.Neutralino;
  globalThis.Neutralino = { os: { getEnv: async (k) => k === 'APPDATA' ? 'C:\\Users\\fake\\AppData\\Roaming' : null } };
  try {
    const p = await pathCacheWebView2Async();
    assert.equal(p, 'C:\\Users\\fake\\AppData\\Roaming\\MLopesFinance.exe\\EBWebView');
  } finally {
    globalThis.Neutralino = original;
  }
});

test('update: invalidarCacheWebView2 faz rd /S /Q em Cache\\Cache_Data, Code Cache e GPUCache', async () => {
  const original = globalThis.Neutralino;
  const calls = [];
  globalThis.Neutralino = {
    os: {
      getEnv: async (k) => k === 'APPDATA' ? 'C:\\Users\\fake\\AppData\\Roaming' : null,
      execCommand: async (cmd) => { calls.push(cmd); return { exitCode: 0, stdOut: '', stdErr: '' }; },
    },
  };
  try {
    const r = await invalidarCacheWebView2();
    assert.equal(r.ok, true);
    assert.equal(calls.length, 3);
    assert.ok(calls[0].includes('C:\\Users\\fake\\AppData\\Roaming\\MLopesFinance.exe\\EBWebView\\Cache\\Cache_Data'), '1o alvo deve ser Cache\\Cache_Data: ' + calls[0]);
    assert.ok(calls[1].includes('Code Cache'), '2o alvo deve ser Code Cache: ' + calls[1]);
    assert.ok(calls[2].includes('GPUCache'), '3o alvo deve ser GPUCache: ' + calls[2]);
    for (const c of calls) {
      assert.ok(c.startsWith('cmd.exe /c rd /S /Q "'), 'cmd deve ser rd /S /Q: ' + c);
    }
  } finally {
    globalThis.Neutralino = original;
  }
});

test('update: invalidarCacheWebView2 e tolerante a erros do execCommand (um falha, outros continuam)', async () => {
  const original = globalThis.Neutralino;
  const calls = [];
  globalThis.Neutralino = {
    os: {
      getEnv: async (k) => k === 'APPDATA' ? 'C:\\Users\\fake' : null,
      execCommand: async (cmd) => {
        calls.push(cmd);
        if (cmd.includes('Cache\\Cache_Data')) throw new Error('arquivo em uso');
        return { exitCode: 0, stdOut: '', stdErr: '' };
      },
    },
  };
  try {
    const r = await invalidarCacheWebView2();
    assert.equal(r.ok, true);
    assert.equal(calls.length, 3, 'deve tentar os 3 alvos mesmo se um falhar');
    assert.equal(r.resultados[0].erro, 'arquivo em uso');
    assert.equal(r.resultados[1].exitCode, 0);
  } finally {
    globalThis.Neutralino = original;
  }
});

test('update: aplicarAtualizacao invalida cache do WebView2 ANTES do restartProcess', async () => {
  const original = globalThis.Neutralino;
  const ordem = [];
  globalThis.Neutralino = {
    os: {
      getEnv: async (k) => k === 'LOCALAPPDATA' ? 'C:\\Users\\fake\\AppData\\Local' : (k === 'APPDATA' ? 'C:\\Users\\fake\\AppData\\Roaming' : null),
      execCommand: async (cmd) => {
        if (cmd.startsWith('cmd.exe /c move /Y')) {
          ordem.push('move');
          return { exitCode: 0, stdOut: '', stdErr: '' };
        }
        if (cmd.startsWith('cmd.exe /c rd /S /Q')) {
          // guarda so' o pedaco relevante: tudo entre as aspas
          const m = cmd.match(/"([^"]+)"/);
          ordem.push('rd:' + (m ? m[1] : '?'));
          return { exitCode: 0, stdOut: '', stdErr: '' };
        }
        return { exitCode: 0, stdOut: '', stdErr: '' };
      },
    },
    filesystem: {
      getStats: async (p) => ({ size: 5 * 1024 * 1024 }),
    },
    app: {
      restartProcess: async () => { ordem.push('restart'); },
    },
  };
  try {
    const r = await aplicarAtualizacao('C:\\Users\\fake\\AppData\\Local\\Programs\\MLopes Finance\\resources.neu.tmp');
    assert.equal(r.ok, true);
    assert.equal(r.reiniciado, true);
    // move vem primeiro, depois 3 rd (cache), depois restart
    assert.deepEqual(ordem, [
      'move',
      'rd:C:\\Users\\fake\\AppData\\Roaming\\MLopesFinance.exe\\EBWebView\\Cache\\Cache_Data',
      'rd:C:\\Users\\fake\\AppData\\Roaming\\MLopesFinance.exe\\EBWebView\\Code Cache',
      'rd:C:\\Users\\fake\\AppData\\Roaming\\MLopesFinance.exe\\EBWebView\\GPUCache',
      'restart',
    ], 'ordem deve ser move -> 3*rd -> restart, foi: ' + JSON.stringify(ordem));
  } finally {
    globalThis.Neutralino = original;
  }
});

test('update: aplicarAtualizacao segue para restart mesmo se invalidarCacheWebView2 falhar', async () => {
  const original = globalThis.Neutralino;
  let restartChamado = false;
  globalThis.Neutralino = {
    os: {
      getEnv: async (k) => k === 'LOCALAPPDATA' ? 'C:\\Users\\fake\\AppData\\Local' : (k === 'APPDATA' ? null : null),
      execCommand: async (cmd) => {
        if (cmd.startsWith('cmd.exe /c move /Y')) return { exitCode: 0, stdOut: '', stdErr: '' };
        if (cmd.startsWith('cmd.exe /c rd /S /Q')) throw new Error('rd falhou');
        return { exitCode: 0, stdOut: '', stdErr: '' };
      },
    },
    filesystem: {
      getStats: async (p) => ({ size: 5 * 1024 * 1024 }),
    },
    app: {
      restartProcess: async () => { restartChamado = true; },
    },
  };
  try {
    const r = await aplicarAtualizacao('C:\\fake\\resources.neu.tmp');
    assert.equal(r.ok, true, 'update deve ter sucesso mesmo com falha no rd');
    assert.equal(restartChamado, true, 'restartProcess deve ser chamado mesmo se rd falhar');
  } finally {
    globalThis.Neutralino = original;
  }
});

// ============================================================================
// EXCLUSAO DE CADASTROS + LANCAMENTOS (CRUD completo)
// ============================================================================
// Motiva: o user precisa poder apagar o que cadastrou pra teste, sem ficar
// preso a dados errados. Regra do PADRAO: lancamento CONCILIADO nao pode
// ser excluido — correcoes sao por estorno (lancamento inverso).

// --- Excluir contexto ---
test('excluirContexto: bloqueia se tem contas vinculadas', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'Teste' });
  criarConta(db, { contextoId: cid, nome: 'Conta 1' });
  assert.throws(() => excluirContexto(db, cid), /contas/);
});

test('excluirContexto: permite excluir contexto vazio (so categoria seed)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'Vazio' });
  // categoria "Transferencia interna" e' seed automatico, nao conta como dependencia
  excluirContexto(db, cid);
  assert.equal(obterContexto(db, cid), null);
});

test('excluirContexto: cascade:true remove tudo (contas, categorias, lancamentos)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'Cascata' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta X' });
  const catId = criarCategoria(db, { contextoId: cid, nome: 'Cat', natureza: 'despesa' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, categoriaId: catId, natureza: 'despesa', valorCentavos: 1000, dataCompetencia: '2026-08-01', descricao: 'X' });
  excluirContexto(db, cid, { cascade: true });
  assert.equal(obterContexto(db, cid), null);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM contas WHERE id = ?', [contaId])[0].values[0][0]), 0, 'conta foi removida');
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM categorias WHERE id = ?', [catId])[0].values[0][0]), 0, 'categoria custom foi removida');
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE id = ?', [lid])[0].values[0][0]), 0, 'lancamento foi removido');
  // Categoria seed ("Transferencia interna") tambem foi removida
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM categorias WHERE contexto_id = ?', [cid])[0].values[0][0]), 0, 'categoria seed removida');
});

// --- Excluir conta ---
test('excluirConta: bloqueia se tem lancamentos vinculados', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'x' });
  assert.throws(() => excluirConta(db, contaId), /lancamentos/);
});

test('excluirConta: cascade:true remove lancamentos vinculados', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'x' });
  excluirConta(db, contaId, { cascade: true });
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE id = ?', [lid])[0].values[0][0]), 0);
});

// --- Excluir categoria ---
test('excluirCategoria: bloqueia se tem lancamentos', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const catId = criarCategoria(db, { contextoId: cid, nome: 'Test', natureza: 'despesa' });
  criarLancamento(db, { contextoId: cid, contaId, categoriaId: catId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'x' });
  assert.throws(() => excluirCategoria(db, catId), /lancamento/);
});

test('excluirCategoria: cascade:true zera categoria_id dos lancamentos', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const catId = criarCategoria(db, { contextoId: cid, nome: 'Test', natureza: 'despesa' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, categoriaId: catId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'x' });
  excluirCategoria(db, catId, { cascade: true });
  const catDoLanc = db.exec('SELECT categoria_id FROM lancamentos WHERE id = ?', [lid])[0].values[0][0];
  assert.equal(catDoLanc, null);
});

// --- Excluir cliente / fornecedor / projeto / centro de custo / tag ---
test('excluirCliente: bloqueia se tem lancamentos', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const clienteId = criarCliente(db, { contextoId: cid, nome: 'Cli' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  criarLancamento(db, { contextoId: cid, contaId, clienteId, natureza: 'receita', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'x' });
  assert.throws(() => excluirCliente(db, clienteId), /lancamentos/);
});

test('excluirFornecedor: pode sempre (sem FK reversa)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const fid = criarFornecedor(db, { contextoId: cid, nome: 'Forn' });
  excluirFornecedor(db, fid);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM fornecedores WHERE id = ?', [fid])[0].values[0][0]), 0);
});

test('excluirProjeto: bloqueia se tem lancamentos', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const pid = criarProjeto(db, { contextoId: cid, nome: 'Proj' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  criarLancamento(db, { contextoId: cid, contaId, projetoId: pid, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'x' });
  assert.throws(() => excluirProjeto(db, pid), /lancamento/);
});

test('excluirCentroCusto: bloqueia se tem lancamentos', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const ccId = criarCentroCusto(db, { contextoId: cid, nome: 'CC' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  criarLancamento(db, { contextoId: cid, contaId, centroCustoId: ccId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'x' });
  assert.throws(() => excluirCentroCusto(db, ccId), /lancamento/);
});

test('excluirTag: apaga direto (cascade via FK remove lancamento_tags)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const tagId = criarTag(db, { contextoId: cid, nome: 'Tag' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'x' });
  vincularTagLancamento(db, lid, tagId);
  excluirTag(db, tagId);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM tags WHERE id = ?', [tagId])[0].values[0][0]), 0);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM lancamento_tags WHERE tag_id = ?', [tagId])[0].values[0][0]), 0, 'viculos foram removidos em cascata');
});

// --- Excluir recorrencia ---
test('excluirRecorrencia: desativa por padrao (mantem historico)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'Template' });
  const rid = criarRecorrencia(db, { contextoId: cid, lancamentoTemplateId: lid, periodicidade: 'mensal' });
  const r = excluirRecorrencia(db, rid);
  assert.equal(r.ativa, false);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM recorrencias WHERE id = ?', [rid])[0].values[0][0]), 1, 'ainda existe (foi desativada)');
  assert.equal(Number(db.exec('SELECT ativa FROM recorrencias WHERE id = ?', [rid])[0].values[0][0]), 0);
});

test('excluirRecorrencia: cascade:true apaga de verdade', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'Tpl' });
  const rid = criarRecorrencia(db, { contextoId: cid, lancamentoTemplateId: lid, periodicidade: 'mensal' });
  excluirRecorrencia(db, rid, { cascade: true });
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM recorrencias WHERE id = ?', [rid])[0].values[0][0]), 0);
});

// --- Excluir transferencia ---
test('excluirTransferencia: desvincula por padrao (lancamentos permanecem)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const c1 = criarConta(db, { contextoId: cid, nome: 'Origem' });
  const c2 = criarConta(db, { contextoId: cid, nome: 'Destino' });
  const t = criarTransferencia(db, { contextoId: cid, contaOrigemId: c1, contaDestinoId: c2, valorCentavos: 1000, dataCompetencia: '2026-08-01' });
  excluirTransferencia(db, t.id);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM transferencias WHERE id = ?', [t.id])[0].values[0][0]), 0, 'transferencia removida');
  // Os 2 lancamentos continuam (apenas sem vinculo)
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE id IN (?, ?)', [t.idSaida, t.idEntrada])[0].values[0][0]), 2);
  assert.equal(db.exec('SELECT transferencia_id FROM lancamentos WHERE id = ?', [t.idSaida])[0].values[0][0], null, 'lancamento saida desvinculado');
});

// --- Excluir lancamento ---
test('excluirLancamento: bloqueia se conciliado (regra do PADRAO)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'x' });
  conciliarLancamento(db, lid);
  assert.throws(() => excluirLancamento(db, lid), /conciliado/);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE id = ?', [lid])[0].values[0][0]), 1, 'lancamento continua existindo');
});

test('excluirLancamento: bloqueia se faz parte de transferencia', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const c1 = criarConta(db, { contextoId: cid, nome: 'O' });
  const c2 = criarConta(db, { contextoId: cid, nome: 'D' });
  const t = criarTransferencia(db, { contextoId: cid, contaOrigemId: c1, contaDestinoId: c2, valorCentavos: 100, dataCompetencia: '2026-08-01' });
  assert.throws(() => excluirLancamento(db, t.idSaida), /transferencia/);
});

test('excluirLancamento: remove lancamento aberto + cascade nas baixas', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 1000, dataCompetencia: '2026-08-01', descricao: 'x' });
  const { registrarBaixa } = await import('../src/js/backend/core/baixas.js');
  registrarBaixa(db, { lancamentoId: lid, valorCentavos: 500, dataBaixa: '2026-08-02' });
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM baixas WHERE lancamento_id = ?', [lid])[0].values[0][0]), 1);
  excluirLancamento(db, lid);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE id = ?', [lid])[0].values[0][0]), 0);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM baixas WHERE lancamento_id = ?', [lid])[0].values[0][0]), 0, 'baixas foram removidas');
});

// --- Estornar lancamento ---
test('estornarLancamento: cria lancamento inverso + marca original como estornado', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 1000, dataCompetencia: '2026-08-01', descricao: 'Original' });
  const r = estornarLancamento(db, lid, '2026-08-05');
  assert.equal(r.ok, true);
  assert.equal(r.naturezaOriginal, 'despesa');
  assert.equal(r.naturezaEstorno, 'receita');
  // Original marcado como estornado
  const statusOrig = db.exec('SELECT status FROM lancamentos WHERE id = ?', [lid])[0].values[0][0];
  assert.equal(statusOrig, 'estornado');
  // Estorno criado com valor igual e natureza inversa
  // Schema lancamentos: 0=id 1=contexto_id 2=conta_id 3=categoria_id 4=cliente_id 5=projeto_id
  //                    6=centro_custo_id 7=natureza 8=valor_centavos 9=data_competencia
  //                    10=data_vencimento 11=descricao 12=observacoes 13=transferencia_id
  //                    14=status 15=criado_em 16=atualizado_em
  const lancEstorno = obterLancamento(db, r.idEstorno);
  assert.equal(lancEstorno[7], 'receita', 'natureza inversa (col 7)');
  assert.equal(lancEstorno[8], 1000, 'valor_centavos preservado (col 8)');
  assert.ok(String(lancEstorno[11] || '').includes('ESTORNO'), 'descricao (col 11) menciona ESTORNO');
});

test('estornarLancamento: tambem funciona em lancamento conciliado (regra do PADRAO)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, natureza: 'receita', valorCentavos: 5000, dataCompetencia: '2026-08-01', descricao: 'Receita conciliada' });
  conciliarLancamento(db, lid);
  // Estornar DEVE funcionar mesmo se conciliado (e' justamente pra isso que serve)
  const r = estornarLancamento(db, lid);
  assert.equal(r.ok, true);
});

// --- Editar lancamento ---
test('editarLancamento: atualiza campos permitidos se nao conciliado', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 1000, dataCompetencia: '2026-08-01', descricao: 'Original' });
  editarLancamento(db, lid, { valor_centavos: 2000, descricao: 'Atualizado', observacoes: 'obs' });
  // Schema: 8=valor_centavos 11=descricao 12=observacoes
  const l = obterLancamento(db, lid);
  assert.equal(l[8], 2000, 'valor_centavos atualizado (col 8)');
  assert.equal(l[11], 'Atualizado', 'descricao atualizada (col 11)');
  assert.equal(l[12], 'obs', 'observacoes atualizadas (col 12)');
});

test('editarLancamento: bloqueia se conciliado (regra do PADRAO)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'x' });
  conciliarLancamento(db, lid);
  assert.throws(() => editarLancamento(db, lid, { descricao: 'nao' }), /conciliado/);
});

test('listarLancamentos: retorna ordenado por data desc, exclui estornados por padrao', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const l1 = criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'A' });
  const l2 = criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 200, dataCompetencia: '2026-08-15', descricao: 'B' });
  const l3 = criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 300, dataCompetencia: '2026-08-10', descricao: 'C' });
  const r = estornarLancamento(db, l3);
  // Apos estornar l3, existe o lancamento inverso (id = r.idEstorno) com status 'aberto'.
  // listarLancamentos (padrao) deve mostrar: l2, l3_estorno, l1 (3 itens), SEM l3 original.
  const todos = listarLancamentos(db, cid);
  assert.equal(todos.length, 3, 'l3 original (estornado) nao aparece; l3_estorno + l1 + l2 = 3');
  const ids = todos.map((r) => r[0]);
  assert.ok(!ids.includes(l3), 'l3 original nao aparece');
  assert.ok(ids.includes(r.idEstorno), 'l3_estorno aparece');
  // Ordem por data desc: B (2026-08-15) > estorno (2026-08-10) > A (2026-08-01)
  // incluirEstornados: true mostra TUDO (4: l1, l2, l3, l3_estorno)
  const comEstornados = listarLancamentos(db, cid, { incluirEstornados: true });
  assert.equal(comEstornados.length, 4);
});

// --- Resetar banco ---
test('resetarBanco: apaga TODAS as tabelas transacionais e recria contexto "Pessoal"', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'Antigo' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  const catId = criarCategoria(db, { contextoId: cid, nome: 'Cat' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, categoriaId: catId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'x' });
  criarCliente(db, { contextoId: cid, nome: 'Cli' });
  criarFornecedor(db, { contextoId: cid, nome: 'Forn' });
  criarProjeto(db, { contextoId: cid, nome: 'Proj' });
  criarCentroCusto(db, { contextoId: cid, nome: 'CC' });
  criarTag(db, { contextoId: cid, nome: 'Tag' });

  const r = resetarBanco(db);
  assert.equal(r.ok, true);

  // Contexto "Antigo" sumiu (cuidado: o ID pode ter sido reusado pelo "Pessoal")
  assert.equal(Number(db.exec("SELECT COUNT(*) FROM contextos_financeiros WHERE nome = 'Antigo'")[0].values[0][0]), 0, 'Contexto Antigo sumiu');
  // Lancamento/conta/categoria/cliente/etc sumiram
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM lancamentos')[0].values[0][0]), 0);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM contas')[0].values[0][0]), 0);
  assert.equal(Number(db.exec("SELECT COUNT(*) FROM categorias WHERE nome != 'Transferência interna' OR natureza != 'ambas'")[0].values[0][0]), 0, 'categorias do user foram apagadas (seed pode estar no novo contexto)');
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM clientes')[0].values[0][0]), 0);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM fornecedores')[0].values[0][0]), 0);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM projetos')[0].values[0][0]), 0);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM centros_custo')[0].values[0][0]), 0);
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM tags')[0].values[0][0]), 0);

  // Schema foi preservado (tabela ainda existe)
  assert.ok(db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='lancamentos'")[0]?.values?.length === 1);

  // Contexto "Pessoal" foi criado
  const ctxPessoal = db.exec("SELECT id, nome FROM contextos_financeiros WHERE nome = 'Pessoal'")[0]?.values?.[0];
  assert.ok(ctxPessoal, 'contexto Pessoal foi criado');
  assert.equal(ctxPessoal[1], 'Pessoal', 'coluna nome (1) e Pessoal');

  // Categoria "Transferência interna" foi criada no contexto Pessoal
  const cat = db.exec("SELECT nome, natureza FROM categorias WHERE contexto_id = ? AND nome LIKE 'Transferência%'", [ctxPessoal[0]])[0]?.values?.[0];
  assert.ok(cat, 'categoria Transferencia interna foi criada');
  assert.equal(cat[1], 'ambas', 'coluna natureza (1) e ambas');

  // Configuracoes foram PRESERVADAS (defaults nao foram apagados)
  const tema = db.exec("SELECT valor FROM configuracoes WHERE chave = 'tema'")[0]?.values?.[0]?.[0];
  assert.equal(tema, 'dark', 'configuracao tema preservada');
});

test('resetarBanco: e idempotente (rodar 2x da certo)', async () => {
  const db = await novoBanco();
  resetarBanco(db);
  const r2 = resetarBanco(db);
  assert.equal(r2.ok, true);
  // Continua so com 1 contexto (Pessoal)
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM contextos_financeiros')[0].values[0][0]), 1);
});

// --- listarLancamentosDetalhados (v0.8.16) ---
// Bug historico: v0.8.15 trocou a query com JOINs por SELECT * e a UI renderLancamentos
// quebrou (esperava 22 colunas, recebia 17). v0.8.16 reintroduz os JOINs.
test('listarLancamentosDetalhados: retorna 24 colunas (19 lanc + 5 nomes)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Banco' });
  const catId = criarCategoria(db, { contextoId: cid, nome: 'Salario', natureza: 'receita' });
  const clienteId = criarCliente(db, { contextoId: cid, nome: 'Cli' });
  const projetoId = criarProjeto(db, { contextoId: cid, nome: 'Proj' });
  const ccId = criarCentroCusto(db, { contextoId: cid, nome: 'CC' });
  const lid = criarLancamento(db, { contextoId: cid, contaId, categoriaId: catId, clienteId, projetoId, centroCustoId: ccId, natureza: 'receita', valorCentavos: 1000, dataCompetencia: '2026-08-01', descricao: 'Test' });
  const r = listarLancamentosDetalhados(db, cid);
  assert.equal(r.length, 1, '1 lancamento retornado');
  const row = r[0];
  assert.equal(row.length, 24, 'deve ter 24 colunas (19 de lancamentos + 5 JOINs) — v0.9.0 adicionou cartao_id e fatura_id');
  // Conferir colunas de join (v0.9.0: cartao_id e fatura_id foram adicionados em lancamentos,
  // entao as colunas de JOIN foram pra 19, 20, 21, 22, 23)
  assert.equal(row[19], 'Banco', 'conta_nome na col 19 (v0.9.0)');
  assert.equal(row[20], 'Salario', 'categoria_nome na col 20 (v0.9.0)');
  assert.equal(row[21], 'Cli', 'cliente_nome na col 21 (v0.9.0)');
  assert.equal(row[22], 'Proj', 'projeto_nome na col 22 (v0.9.0)');
  assert.equal(row[23], 'CC', 'centro_custo_nome na col 23 (v0.9.0)');
  // Conferir colunas de lancamentos
  assert.equal(row[0], lid, 'id na col 0');
  assert.equal(row[7], 'receita', 'natureza na col 7');
  assert.equal(row[8], 1000, 'valor_centavos na col 8');
  assert.equal(row[11], 'Test', 'descricao na col 11');
  // v0.9.0: cartao_id e fatura_id foram adicionados (col 14 e 15, depois de transferencia_id)
  assert.equal(row[14], null, 'cartao_id na col 14 (sem cartao)');
  assert.equal(row[15], null, 'fatura_id na col 15 (sem fatura)');
  // status passou de 14 pra 16 (depois das 2 colunas novas)
  assert.equal(row[16], 'aberto', 'status na col 16');
});

test('listarLancamentosDetalhados: exclui transferencias e estornados por padrao', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const c1 = criarConta(db, { contextoId: cid, nome: 'O' });
  const c2 = criarConta(db, { contextoId: cid, nome: 'D' });
  const t = criarTransferencia(db, { contextoId: cid, contaOrigemId: c1, contaDestinoId: c2, valorCentavos: 100, dataCompetencia: '2026-08-01' });
  const r = listarLancamentosDetalhados(db, cid);
  // Os 2 lancamentos da transferencia (saida + entrada) nao devem aparecer
  assert.equal(r.length, 0, 'transferencias nao aparecem em listarLancamentosDetalhados');
});

// --- excluirTodosLancamentos (v0.8.17) ---
// Botao "Excluir todos" da tela de Lancamentos. Apaga todos os lancamentos do
// contexto (com cascade: baixas, tags, transferencias orfas) sem mexer
// nos cadastros (contas, categorias, clientes, etc).
test('excluirTodosLancamentos: apaga todos os lancamentos + cascade (baixas, transferencias)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'Limpar' });
  const c1 = criarConta(db, { contextoId: cid, nome: 'Conta1' });
  const c2 = criarConta(db, { contextoId: cid, nome: 'Conta2' });
  const cat = criarCategoria(db, { contextoId: cid, nome: 'Cat', natureza: 'despesa' });
  // 3 lancamentos manuais
  const l1 = criarLancamento(db, { contextoId: cid, contaId: c1, categoriaId: cat, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'A' });
  const l2 = criarLancamento(db, { contextoId: cid, contaId: c1, natureza: 'receita', valorCentavos: 200, dataCompetencia: '2026-08-02', descricao: 'B' });
  const l3 = criarLancamento(db, { contextoId: cid, contaId: c2, natureza: 'despesa', valorCentavos: 300, dataCompetencia: '2026-08-03', descricao: 'C' });
  // 1 transferencia (gera 2 lancamentos: saida + entrada)
  const t = criarTransferencia(db, { contextoId: cid, contaOrigemId: c1, contaDestinoId: c2, valorCentavos: 50, dataCompetencia: '2026-08-04' });
  // 1 baixa em l1
  const { registrarBaixa } = await import('../src/js/backend/core/baixas.js');
  registrarBaixa(db, { lancamentoId: l1, valorCentavos: 50, dataBaixa: '2026-08-05' });
  // Sanity: 3 manuais + 2 transferencia = 5
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE contexto_id = ?', [cid])[0].values[0][0]), 5, 'sanity: 3 manuais + 2 transferencia');
  // Excluir todos
  const r = excluirTodosLancamentos(db, cid);
  assert.equal(r.ok, true);
  assert.equal(r.excluidos, 5, '5 lancamentos excluidos (3 + 2 transferencia)');
  // Cadastros preservados
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM contas WHERE contexto_id = ?', [cid])[0].values[0][0]), 2, 'contas preservadas');
  // 1 categoria customizada (Cat) + 1 seed (Transferencia interna) = 2
  assert.equal(Number(db.exec("SELECT COUNT(*) FROM categorias WHERE contexto_id = ? AND nome != 'Transferência interna'", [cid])[0].values[0][0]), 1, 'categoria custom preservada');
  // Baixas apagadas
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM baixas')[0].values[0][0]), 0, 'baixas apagadas');
  // Transferencias orfas apagadas
  assert.equal(Number(db.exec('SELECT COUNT(*) FROM transferencias')[0].values[0][0]), 0, 'transferencia orfa apagada');
});

test('excluirTodosLancamentos: idempotente (rodar 2x da certo)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Conta' });
  criarLancamento(db, { contextoId: cid, contaId, natureza: 'despesa', valorCentavos: 100, dataCompetencia: '2026-08-01', descricao: 'A' });
  const r1 = excluirTodosLancamentos(db, cid);
  assert.equal(r1.excluidos, 1);
  const r2 = excluirTodosLancamentos(db, cid);
  assert.equal(r2.excluidos, 0, 'segunda chamada nao exclui nada');
});

// --- criarPreviaImportacao: dedup dentro do arquivo (v0.8.18) ---
// Bug historico: extrato do banco vinha com 2 linhas identicas (mesma data+valor+descricao).
// O INSERT dava UNIQUE constraint failed na chave_externa. Corrigido com dedup
// ANTES do INSERT + INSERT OR IGNORE por seguranca.
test('importacao: criarPreviaImportacao dedup dentro do arquivo (mesma transacao 2x)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  // CSV com 2 linhas identicas + 1 diferente
  const csv = [
    'data,valor,descricao',
    '2026-01-15,100.00,COMPRA MERCADO',
    '2026-01-15,100.00,COMPRA MERCADO', // duplicata exata
    '2026-01-20,50.00,COMPRA FARMACIA',
  ].join('\n');
  const idImport = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.csv', formato: 'csv', conteudo: csv });
  const itens = db.exec('SELECT data_transacao, valor_centavos, descricao FROM itens_importacao WHERE importacao_id = ?', [idImport])[0].values;
  assert.equal(itens.length, 2, '2 itens unicos (duplicata eliminada)');
  const totais = db.exec('SELECT total_registros FROM importacoes WHERE id = ?', [idImport])[0].values[0][0];
  assert.equal(totais, 3, 'total_registros preserva o original (3 linhas do CSV)');
});

test('importacao: criarPreviaImportacao nao falha com INSERT OR IGNORE em duplicata exata', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const csv = 'data,valor,descricao\n2026-01-15,100.00,X\n2026-01-15,100.00,X\n2026-01-15,100.00,X';
  // Antes do fix, dava UNIQUE constraint failed. Agora deve passar e manter so 1.
  const idImport = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'b.csv', formato: 'csv', conteudo: csv });
  const itens = db.exec('SELECT COUNT(*) FROM itens_importacao WHERE importacao_id = ?', [idImport])[0].values[0][0];
  assert.equal(itens, 1, 'so 1 item foi inserido (3 linhas identicas viram 1)');
});

// --- inferirNaturezaItem (v0.8.19) ---
// User pediu: "ele tem que achar sozinho". O app deve inferir a natureza
// (receita|despesa) sem perguntar, usando heuristicas:
// 1. Tipo da conta (cartao = sempre despesa)
// 2. Palavras-chave na descricao (BOLETO -> despesa, PIX RECEBIDO -> receita)
// 3. Sinal do valor (negativo = despesa)
// 4. Fallback = padraoNatureza (default despesa)
test('inferirNaturezaItem: cartao de credito = sempre despesa (mesmo valor positivo)', () => {
  const r = inferirNaturezaItem({ descricao: 'COMPRA RESTAURANTE', valor: 5000, contaTipo: 'cartao' });
  assert.equal(r.natureza, 'despesa');
  assert.ok(r.motivo.includes('cartão'), `motivo deveria mencionar cartão: ${r.motivo}`);
});

test('inferirNaturezaItem: palavras-chave de despesa (BOLETO, COMPRA, DEBITO, etc)', () => {
  for (const kw of ['BOLETO', 'COMPRA', 'PAGAMENTO', 'TARIFA', 'JUROS', 'MULTA', 'SAQUE']) {
    const r = inferirNaturezaItem({ descricao: `${kw} X`, valor: 1000, contaTipo: 'bancaria' });
    assert.equal(r.natureza, 'despesa', `keyword "${kw}" deveria ser despesa`);
  }
});

test('inferirNaturezaItem: palavras-chave de receita (RECEBIDO, SALARIO, CRED, etc)', () => {
  for (const kw of ['PIX RECEBIDO', 'TED RECEB', 'SALARIO', 'RENDIMENTO', 'DEPOSITO', 'CRED']) {
    const r = inferirNaturezaItem({ descricao: `${kw} X`, valor: 1000, contaTipo: 'bancaria' });
    assert.equal(r.natureza, 'receita', `keyword "${kw}" deveria ser receita`);
  }
});

test('inferirNaturezaItem: valor negativo = despesa (mesmo sem keyword)', () => {
  const r = inferirNaturezaItem({ descricao: 'TRANSFERENCIA', valor: -100, contaTipo: 'bancaria' });
  assert.equal(r.natureza, 'despesa', 'valor negativo deve ser despesa');
});

test('inferirNaturezaItem: valor positivo sem keyword usa padraoNatureza', () => {
  const d = inferirNaturezaItem({ descricao: 'COISA GENERICA', valor: 100, contaTipo: 'bancaria', padraoNatureza: 'despesa' });
  assert.equal(d.natureza, 'despesa');
  const r = inferirNaturezaItem({ descricao: 'COISA GENERICA', valor: 100, contaTipo: 'bancaria', padraoNatureza: 'receita' });
  assert.equal(r.natureza, 'receita');
});

test('confirmarImportacao: retorna inferencias por item', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  // Conta bancaria (nao cartao) pra testar keywords de despesa
  const c1 = criarConta(db, { contextoId: cid, nome: 'Conta Corrente', tipo: 'bancaria' });
  const csv = [
    'data,valor,descricao',
    '2026-01-15,100.00,BOLETO LUZ',
    '2026-01-16,500.00,PIX RECEBIDO CLIENTE',
    '2026-01-17,50.00,COMPRA IFOOD',
  ].join('\n');
  const idImport = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.csv', formato: 'csv', conteudo: csv });
  const out = confirmarImportacao(db, { importacaoId: idImport, contaId: c1, padraoNatureza: 'despesa' });
  assert.equal(out.importados, 3);
  assert.equal(out.inferencias.length, 3, 'retornou 3 inferencias');
  // BOLETO -> despesa (keyword)
  assert.equal(out.inferencias[0].natureza, 'despesa');
  assert.ok(out.inferencias[0].motivo.includes('BOLETO'), `motivo: ${out.inferencias[0].motivo}`);
  // PIX RECEBIDO -> receita (keyword)
  assert.equal(out.inferencias[1].natureza, 'receita');
  assert.ok(out.inferencias[1].motivo.includes('RECEB'), `motivo: ${out.inferencias[1].motivo}`);
  // COMPRA IFOOD -> despesa (keyword)
  assert.equal(out.inferencias[2].natureza, 'despesa');
  assert.ok(out.inferencias[2].motivo.includes('COMPRA'), `motivo: ${out.inferencias[2].motivo}`);
});

test('confirmarImportacao: cartao sempre classifica como despesa', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const c1 = criarConta(db, { contextoId: cid, nome: 'Cartao Nubank', tipo: 'cartao' });
  const csv = 'data,valor,descricao\n2026-01-15,500.00,PIX RECEBIDO CLIENTE';
  const idImport = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'b.csv', formato: 'csv', conteudo: csv });
  const out = confirmarImportacao(db, { importacaoId: idImport, contaId: c1 });
  // Mesma palavra-chave "RECEB" sugere receita, mas cartao sempre = despesa
  assert.equal(out.inferencias[0].natureza, 'despesa', 'cartao SEMPRE = despesa (mesmo com keyword de receita)');
  assert.ok(out.inferencias[0].motivo.includes('cartão'));
});

// --- v0.8.20: correcoes de importacao ---

// Bug que o Marcio pegou na pratica: importou CSV, excluiu todos os lancamentos
// (que marcou os 63 itens como 'ignorado'), reimportou o mesmo CSV, e a checagem
// antiga (`status='confirmada'`) DEIXOU passar porque a importacao anterior
// nao estava mais 'confirmada' (estava 'previa'/'cancelada' por causa das
// exclusoes). Resultado: 126 itens orfaos no banco e nada pra confirmar.
test('importacao: criarPreviaImportacao bloqueia reimportacao mesmo se anterior NAO esta confirmada', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const csv = 'data,descricao,valor\n2026-01-02,PIX ENVIADO - teste,-100.00';
  // 1a importacao (fica em 'previa')
  const id1 = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.csv', formato: 'csv', conteudo: csv });
  assert.equal(db.exec('SELECT status FROM importacoes WHERE id=?', [id1])[0].values[0][0], 'previa');
  // Tentar recriar o mesmo arquivo (mesmo hash) DEVE falhar mesmo com anterior 'previa'
  assert.throws(
    () => criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.csv', formato: 'csv', conteudo: csv }),
    /ja tem uma importacao/,
    'reimportacao bloqueada quando anterior esta em previa (v0.8.20)'
  );
  // Excluir a anterior libera a criacao
  excluirImportacao(db, id1);
  const id2 = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.csv', formato: 'csv', conteudo: csv });
  assert.ok(Number.isInteger(id2), 'id2 deve ser numero inteiro, foi: ' + id2);
  // sql.js (e SQLite em alguns modos) pode reusar IDs apos DELETE, entao o
  // importante e' que a nova importacao foi CRIADA e esta em status 'previa'
  // (ou seja, nao herdou estado da anterior).
  const status2 = db.exec('SELECT status FROM importacoes WHERE id=?', [id2])[0]?.values?.[0]?.[0];
  assert.equal(status2, 'previa', 'nova importacao em status previa (nao cancelada/previa-antiga)');
  // Confirma que existe 1 importacao com o hash
  const count = db.exec('SELECT COUNT(*) FROM importacoes WHERE contexto_id=?', [cid])[0].values[0][0];
  assert.equal(count, 1, 'so 1 importacao apos excluir+recriar (nao acumulou)');
});

test('importacao: criarPreviaImportacao bloqueia reimportacao quando anterior foi cancelada', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const csv = 'data,descricao,valor\n2026-01-02,PIX ENVIADO - teste,-100.00';
  const id1 = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.csv', formato: 'csv', conteudo: csv });
  cancelarImportacao(db, id1); // vira 'cancelada'
  assert.throws(
    () => criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.csv', formato: 'csv', conteudo: csv }),
    /ja tem uma importacao/,
    'reimportacao bloqueada quando anterior esta cancelada (v0.8.20)'
  );
});

// sql.js nao enforce FK ON DELETE CASCADE por padrao. Sem o DELETE manual
// em excluirImportacao, os 63 itens_importacao ficavam orfaos no banco
// (FK violation silenciosa). Esse teste prova que o DELETE manual limpa
// tudo, mesmo com FK desabilitada.
test('importacao: excluirImportacao remove itens manualmente (sql.js nao enforce CASCADE)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const csv = 'data,descricao,valor\n2026-01-02,PIX ENVIADO - A,-100.00\n2026-01-03,PIX ENVIADO - B,-200.00';
  const id = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.csv', formato: 'csv', conteudo: csv });
  // Confirma itens foram inseridos
  const antes = db.exec('SELECT COUNT(*) FROM itens_importacao WHERE importacao_id=?', [id])[0].values[0][0];
  assert.equal(antes, 2);
  // sql.js: PRAGMA foreign_keys fica OFF por padrao, entao o ON DELETE CASCADE
  // do schema nao dispara. Excluir a importacao SEM o DELETE manual deixaria
  // os 2 itens orfaos. Antes da v0.8.20 isso acontecia.
  db.run('PRAGMA foreign_keys = OFF');
  const out = excluirImportacao(db, id);
  db.run('PRAGMA foreign_keys = ON');
  assert.equal(out.ok, true);
  assert.equal(out.itensRemovidos, 2);
  // Confirma que nao ha orfaos
  const orfaos = db.exec('SELECT COUNT(*) FROM itens_importacao WHERE importacao_id=?', [id])[0].values[0][0];
  assert.equal(orfaos, 0, 'nenhum item orfao apos excluirImportacao (v0.8.20)');
  const imp = db.exec('SELECT id FROM importacoes WHERE id=?', [id])[0]?.values?.length ?? 0;
  assert.equal(imp, 0, 'importacao removida');
});

// Caso de uso direto do Marcio: importou CSV, confirmou 63 lancamentos,
// excluiu todos -> 63 itens viraram 'ignorado'. Sem reciclarImportacao,
// o caminho era excluir a importacao e reimportar do zero (perdia o
// contexto de auditoria e obrigava novo upload do arquivo).
test('importacao: reciclarImportacao marca ignorados e duplicados como pendente', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Cartao', tipo: 'cartao' });
  const csv = 'data,descricao,valor\n2026-01-02,PIX ENVIADO - A,-100.00\n2026-01-03,PIX ENVIADO - B,-200.00\n2026-01-04,PIX ENVIADO - C,-300.00';
  const id = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.csv', formato: 'csv', conteudo: csv });
  // Simula o "Excluir todos lancamentos" — marca os 3 itens como 'ignorado'
  db.run("UPDATE itens_importacao SET status='ignorado' WHERE importacao_id=?", [id]);
  // Tenta confirmar — deve falhar pq nao tem 'pendente'
  assert.throws(() => confirmarImportacao(db, { importacaoId: id, contaId }), /pendente/);
  // Reciclar
  const out = reciclarImportacao(db, id);
  assert.equal(out.ok, true);
  assert.equal(out.reciclados, 3, 'recicla os 3 ignorados');
  // Agora confirma funciona
  const conf = confirmarImportacao(db, { importacaoId: id, contaId });
  assert.equal(conf.importados, 3);
});

test('importacao: reciclarImportacao nao mexe em importado (so ignorado/duplicado)', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaId = criarConta(db, { contextoId: cid, nome: 'Cartao', tipo: 'cartao' });
  // 3 itens: 1 vai virar 'importado' (intocado), 1 'ignorado' (reciclado),
  // 1 'duplicado' (reciclado)
  const csv = 'data,descricao,valor\n2026-01-02,PIX ENVIADO - A,-100.00\n2026-01-03,PIX ENVIADO - B,-200.00\n2026-01-04,PIX ENVIADO - C,-300.00';
  const id = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.csv', formato: 'csv', conteudo: csv });
  confirmarImportacao(db, { importacaoId: id, contaId }); // 3 viram 'importado'
  // Forca 1 pra 'ignorado' (simula exclusao de 1 lancamento) e outro pra 'duplicado'
  db.run("UPDATE itens_importacao SET status='ignorado' WHERE id=(SELECT id FROM itens_importacao WHERE importacao_id=? AND status='importado' ORDER BY id LIMIT 1)", [id]);
  db.run("UPDATE itens_importacao SET status='duplicado' WHERE id=(SELECT id FROM itens_importacao WHERE importacao_id=? AND status='importado' ORDER BY id DESC LIMIT 1)", [id]);
  // Estado agora: 1 'importado' (intocado), 1 'ignorado', 1 'duplicado'
  const out = reciclarImportacao(db, id);
  assert.equal(out.reciclados, 2, 'recicla 1 ignorado + 1 duplicado');
  // O 'importado' original NAO pode ter virado 'pendente' (senao duplicaria
  // o lancamento na hora de confirmar). O query do reciclarImportacao filtra
  // status IN ('ignorado','duplicado'), entao 'importado' fica intocado.
  const counts = db.exec('SELECT status, COUNT(*) FROM itens_importacao WHERE importacao_id=? GROUP BY status', [id])[0].values;
  const importadoCount = counts.find(c => c[0] === 'importado')?.[1] ?? 0;
  assert.equal(importadoCount, 1, 'importado permanece intocado (v0.8.20)');
  const pendenteCount = counts.find(c => c[0] === 'pendente')?.[1] ?? 0;
  assert.equal(pendenteCount, 2, '1 ignorado + 1 duplicado viraram pendente');
});

test('importacao: reciclarImportacao sem reciclaveis retorna ok com 0', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const csv = 'data,descricao,valor\n2026-01-02,PIX ENVIADO - A,-100.00';
  const id = criarPreviaImportacao(db, { contextoId: cid, arquivoOrigem: 'a.csv', formato: 'csv', conteudo: csv });
  // Sem nenhum 'ignorado' ou 'duplicado' (so 'pendente')
  const out = reciclarImportacao(db, id);
  assert.equal(out.ok, true);
  assert.equal(out.reciclados, 0);
});

// --- v0.9.0: Tela de Cartoes ---

test('cartoes: criarCartao cria cartao E conta associada tipo "cartao"', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const contaBancaria = criarConta(db, { contextoId: cid, nome: 'Banco do Brasil', tipo: 'bancaria' });
  const r = criarCartao(db, { contextoId: cid, nome: 'Nubank', instituicao: 'Nu Pagamentos', limiteCentavos: 500000, diaFechamento: 5, diaVencimento: 15, contaPagamentoId: contaBancaria });
  assert.ok(r.cartaoId > 0);
  assert.ok(r.contaId > 0);
  // Conta associada existe e e' tipo 'cartao'
  const c = db.exec('SELECT nome, tipo FROM contas WHERE id = ?', [r.contaId])[0]?.values?.[0];
  assert.equal(c[0], 'Nubank');
  assert.equal(c[1], 'cartao');
  // cartoes.conta_associada_id aponta pra conta
  const ca = db.exec('SELECT conta_associada_id FROM cartoes WHERE id = ?', [r.cartaoId])[0]?.values?.[0]?.[0];
  assert.equal(ca, r.contaId);
});

test('cartoes: excluirCartao sem cascade BLOQUEIA se tem faturas com lancamentos', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const cb = criarConta(db, { contextoId: cid, nome: 'BB', tipo: 'bancaria' });
  const r = criarCartao(db, { contextoId: cid, nome: 'Nubank', limiteCentavos: 100000, diaFechamento: 5, diaVencimento: 15, contaPagamentoId: cb });
  // Cria fatura + lancamento
  const fatId = abrirFatura(db, { cartaoId: r.cartaoId, ciclo: '2026-08', dataFechamento: '2026-08-05', dataVencimento: '2026-08-15' });
  criarLancamento(db, { contextoId: cid, contaId: r.contaId, natureza: 'despesa', valorCentavos: 5000, dataCompetencia: '2026-08-02', descricao: 'iFood' });
  // Tenta excluir sem cascade → BLOQUEIA
  const out = excluirCartao(db, r.cartaoId);
  assert.equal(out.ok, false);
  assert.equal(out.bloqueadoPor, 'faturas');
  // Tenta com cascade → OK
  const out2 = excluirCartao(db, r.cartaoId, { cascade: true });
  assert.equal(out2.ok, true);
  assert.equal(out2.cascade, true);
  // Conta associada foi desativada (soft delete)
  const ativo = db.exec('SELECT ativo FROM contas WHERE id = ?', [r.contaId])[0]?.values?.[0]?.[0];
  assert.equal(ativo, 0, 'conta associada desativada (soft delete preserva historico)');
});

test('cartoes: criarLancamento em conta tipo cartao AUTO-VINCULA a fatura do ciclo', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const cb = criarConta(db, { contextoId: cid, nome: 'BB', tipo: 'bancaria' });
  // Cartao: dia_fechamento=5, dia_vencimento=15
  const r = criarCartao(db, { contextoId: cid, nome: 'Nubank', limiteCentavos: 100000, diaFechamento: 5, diaVencimento: 15, contaPagamentoId: cb });
  // Compra dia 02/08: ANTES do fechamento (5) → ciclo = 2026-08
  const lid1 = criarLancamento(db, { contextoId: cid, contaId: r.contaId, natureza: 'despesa', valorCentavos: 5000, dataCompetencia: '2026-08-02', descricao: 'iFood' });
  const l1 = db.exec('SELECT cartao_id, fatura_id FROM lancamentos WHERE id = ?', [lid1])[0]?.values?.[0];
  assert.equal(l1[0], r.cartaoId, 'cartao_id auto-setado');
  assert.ok(l1[1] != null, 'fatura_id auto-setado');
  const fat1 = db.exec('SELECT ciclo FROM faturas WHERE id = ?', [l1[1]])[0]?.values?.[0]?.[0];
  assert.equal(fat1, '2026-08', 'compra em 02/08 → fatura 2026-08 (antes do fechamento)');
  // Compra dia 10/08: DEPOIS do fechamento (5) → ciclo = 2026-09
  const lid2 = criarLancamento(db, { contextoId: cid, contaId: r.contaId, natureza: 'despesa', valorCentavos: 3000, dataCompetencia: '2026-08-10', descricao: 'Uber' });
  const l2 = db.exec('SELECT fatura_id FROM lancamentos WHERE id = ?', [lid2])[0]?.values?.[0]?.[0];
  const fat2 = db.exec('SELECT ciclo FROM faturas WHERE id = ?', [l2])[0]?.values?.[0]?.[0];
  assert.equal(fat2, '2026-09', 'compra em 10/08 → fatura 2026-09 (depois do fechamento)');
});

test('cartoes: criarLancamento em conta bancaria NAO vincula a fatura', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const cb = criarConta(db, { contextoId: cid, nome: 'BB', tipo: 'bancaria' });
  // Lancamento em conta bancaria: sem cartao/fatura
  const lid = criarLancamento(db, { contextoId: cid, contaId: cb, natureza: 'despesa', valorCentavos: 5000, dataCompetencia: '2026-08-10', descricao: 'x' });
  const l = db.exec('SELECT cartao_id, fatura_id FROM lancamentos WHERE id = ?', [lid])[0]?.values?.[0];
  assert.equal(l[0], null, 'conta bancaria: cartao_id NULL');
  assert.equal(l[1], null, 'conta bancaria: fatura_id NULL');
});

test('cartoes: valor_total_centavos da fatura atualiza ao criar/excluir lancamento', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const cb = criarConta(db, { contextoId: cid, nome: 'BB', tipo: 'bancaria' });
  const r = criarCartao(db, { contextoId: cid, nome: 'Nubank', limiteCentavos: 100000, diaFechamento: 5, diaVencimento: 15, contaPagamentoId: cb });
  // 2 compras na mesma fatura
  const l1 = criarLancamento(db, { contextoId: cid, contaId: r.contaId, natureza: 'despesa', valorCentavos: 5000, dataCompetencia: '2026-08-02', descricao: 'A' });
  const l2 = criarLancamento(db, { contextoId: cid, contaId: r.contaId, natureza: 'despesa', valorCentavos: 3000, dataCompetencia: '2026-08-03', descricao: 'B' });
  // Pega a fatura do l1 (mesma que l2)
  const fatId = db.exec('SELECT fatura_id FROM lancamentos WHERE id = ?', [l1])[0]?.values?.[0]?.[0];
  const total = db.exec('SELECT valor_total_centavos FROM faturas WHERE id = ?', [fatId])[0]?.values?.[0]?.[0];
  assert.equal(total, 8000, 'fatura soma 5000 + 3000 = 8000');
  // Exclui l2 → total = 5000
  excluirLancamento(db, l2);
  const total2 = db.exec('SELECT valor_total_centavos FROM faturas WHERE id = ?', [fatId])[0]?.values?.[0]?.[0];
  assert.equal(total2, 5000, 'fatura recalcula para 5000 apos excluir l2');
});

test('cartoes: pagarFatura marca lancamento de pagamento com fatura_id', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const cb = criarConta(db, { contextoId: cid, nome: 'BB', tipo: 'bancaria' });
  const r = criarCartao(db, { contextoId: cid, nome: 'Nubank', limiteCentavos: 100000, diaFechamento: 5, diaVencimento: 15, contaPagamentoId: cb });
  const faturaId = abrirFatura(db, { cartaoId: r.cartaoId, ciclo: '2026-08', dataFechamento: '2026-08-05', dataVencimento: '2026-08-15' });
  const pg = pagarFatura(db, { faturaId, contaPagamentoId: cb, valorCentavos: 100000, dataPagamento: '2026-08-15' });
  const fat = db.exec('SELECT fatura_id FROM lancamentos WHERE id = ?', [pg.lancamentoId])[0]?.values?.[0]?.[0];
  assert.equal(fat, faturaId, 'lancamento de pagamento tem fatura_id');
  const statusFatura = db.exec('SELECT status FROM faturas WHERE id = ?', [faturaId])[0]?.values?.[0]?.[0];
  assert.equal(statusFatura, 'paga', 'fatura marcada como paga (valor_pago >= valor_total)');
});

test('cartoes: listarFaturasDetalhadas retorna contagem e soma dos lancamentos', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const cb = criarConta(db, { contextoId: cid, nome: 'BB', tipo: 'bancaria' });
  const r = criarCartao(db, { contextoId: cid, nome: 'Nubank', limiteCentavos: 100000, diaFechamento: 5, diaVencimento: 15, contaPagamentoId: cb });
  // 2 compras na fatura 2026-08
  criarLancamento(db, { contextoId: cid, contaId: r.contaId, natureza: 'despesa', valorCentavos: 5000, dataCompetencia: '2026-08-02', descricao: 'A' });
  criarLancamento(db, { contextoId: cid, contaId: r.contaId, natureza: 'despesa', valorCentavos: 3000, dataCompetencia: '2026-08-03', descricao: 'B' });
  const faturas = listarFaturasDetalhadas(db, r.cartaoId);
  assert.equal(faturas.length, 1);
  // Colunas: 0:id, 1:cartao_id, 2:ciclo, 3:data_fechamento, 4:data_vencimento, 5:valor_total,
  //          6:valor_pago, 7:status, 8:criado_em, 9:atualizado_em, 10:qtd_lancamentos, 11:soma_lancamentos_centavos
  assert.equal(faturas[0][10], 2, 'qtd_lancamentos = 2 (col 10)');
  assert.equal(faturas[0][11], 8000, 'soma_lancamentos_centavos = 8000 (col 11)');
});

test('cartoes: listarLancamentosDaFatura retorna apenas os da fatura', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const cb = criarConta(db, { contextoId: cid, nome: 'BB', tipo: 'bancaria' });
  const r = criarCartao(db, { contextoId: cid, nome: 'Nubank', limiteCentavos: 100000, diaFechamento: 5, diaVencimento: 15, contaPagamentoId: cb });
  // 1 compra em 2026-08, 1 em 2026-09
  criarLancamento(db, { contextoId: cid, contaId: r.contaId, natureza: 'despesa', valorCentavos: 5000, dataCompetencia: '2026-08-02', descricao: 'A' });
  criarLancamento(db, { contextoId: cid, contaId: r.contaId, natureza: 'despesa', valorCentavos: 3000, dataCompetencia: '2026-08-10', descricao: 'B' });
  const faturas = listarFaturasDetalhadas(db, r.cartaoId);
  // col 2 = ciclo (YYYY-MM)
  const fat1Id = faturas.find(f => f[2] === '2026-08')[0];
  const fat2Id = faturas.find(f => f[2] === '2026-09')[0];
  const lancs1 = listarLancamentosDaFatura(db, fat1Id);
  const lancs2 = listarLancamentosDaFatura(db, fat2Id);
  // Colunas: 0:id, 1:contexto_id, 2:conta_id, 3:categoria_id, 4:natureza, 5:valor_centavos,
  //          6:data_competencia, 7:data_vencimento, 8:descricao, 9:observacoes, 10:status, ...
  assert.equal(lancs1.length, 1, 'fatura 2026-08 tem 1 lancamento');
  assert.equal(lancs1[0][5], 5000, 'valor do lancamento = 5000 (col 5)');
  assert.equal(lancs2.length, 1, 'fatura 2026-09 tem 1 lancamento');
  assert.equal(lancs2[0][5], 3000, 'valor do lancamento = 3000 (col 5)');
});

test('cartoes: atualizarCartao muda dados cadastrais', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const cb = criarConta(db, { contextoId: cid, nome: 'BB', tipo: 'bancaria' });
  const r = criarCartao(db, { contextoId: cid, nome: 'Nubank', limiteCentavos: 100000, diaFechamento: 5, diaVencimento: 15, contaPagamentoId: cb });
  atualizarCartao(db, r.cartaoId, { limiteCentavos: 200000, diaFechamento: 10 });
  const c = db.exec('SELECT limite_centavos, dia_fechamento, dia_vencimento FROM cartoes WHERE id = ?', [r.cartaoId])[0]?.values?.[0];
  assert.equal(c[0], 200000, 'limite atualizado');
  assert.equal(c[1], 10, 'dia_fechamento atualizado');
  assert.equal(c[2], 15, 'dia_vencimento preservado (nao veio no update)');
});

test('cartoes: calcularCicloDaCompra calcula ciclo e datas corretamente', async () => {
  const db = await novoBanco();
  const cid = criarContexto(db, { nome: 'C' });
  const cb = criarConta(db, { contextoId: cid, nome: 'BB', tipo: 'bancaria' });
  const r = criarCartao(db, { contextoId: cid, nome: 'Nubank', limiteCentavos: 100000, diaFechamento: 5, diaVencimento: 15, contaPagamentoId: cb });
  // Compra 2026-08-02 (antes do fechamento 5) → ciclo 2026-08
  const c1 = calcularCicloDaCompra(db, { cartaoId: r.cartaoId, dataCompra: '2026-08-02' });
  assert.equal(c1.ciclo, '2026-08');
  assert.equal(c1.dataFechamento, '2026-08-05');
  assert.equal(c1.dataVencimento, '2026-09-15');
  // Compra 2026-08-10 (depois do fechamento 5) → ciclo 2026-09
  const c2 = calcularCicloDaCompra(db, { cartaoId: r.cartaoId, dataCompra: '2026-08-10' });
  assert.equal(c2.ciclo, '2026-09');
  assert.equal(c2.dataFechamento, '2026-09-05');
  assert.equal(c2.dataVencimento, '2026-10-15');
  // Compra em 31/12 (depois do fechamento) com virada de ano
  const c3 = calcularCicloDaCompra(db, { cartaoId: r.cartaoId, dataCompra: '2026-12-31' });
  assert.equal(c3.ciclo, '2027-01');
});