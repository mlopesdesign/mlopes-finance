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
import { criarCartao, abrirFatura, pagarFatura, calcularCiclo, listarFaturas } from '../src/js/backend/core/cartoes.js';
import { parsearOFX, parsearCSV, criarPreviaImportacao, confirmarImportacao, listarImportacoes, cancelarImportacao, excluirImportacao } from '../src/js/backend/core/importacao.js';
import { balancete, comparativo, exportaCSV, calcularPeriodo } from '../src/js/backend/core/relatorios.js';

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
  // Roda migração cumulativa (v2 → v3 → v4 → v5)
  const v = migrar(db);
  assert.equal(v, 5);
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
  // schema_version foi pra 5
  assert.equal(db.exec("SELECT valor FROM meta WHERE chave = 'schema_version'")[0].values[0][0], '5');
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
  assert.equal(txs[0].valor_centavos, 15050);
  assert.equal(txs[0].descricao, 'IFOOD');
  assert.ok(txs[0].chave_externa.length > 0);
  assert.equal(txs[1].data_transacao, '2026-08-11');
  assert.equal(txs[1].valor_centavos, 350000);
  assert.equal(txs[1].descricao, 'SALARIO');
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

  // CSV com ponto-e-virgula (formato BR/PT) e data dd/mm/yyyy
  const csvPontoVirgula = `data;valor;descricao\n10/08/2026;-200,00;Padaria\n11/08/2026;1500,00;Salario`;
  const txs2 = parsearCSV(csvPontoVirgula);
  assert.equal(txs2.length, 2);
  assert.equal(txs2[0].data_transacao, '2026-08-10');
  assert.equal(txs2[0].valor_centavos, 20000);
  assert.equal(txs2[0].descricao, 'Padaria');
  assert.equal(txs2[1].data_transacao, '2026-08-11');
  assert.equal(txs2[1].valor_centavos, 150000);
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
    /ja foi importado/
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