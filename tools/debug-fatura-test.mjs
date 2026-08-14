// Debug isolado do teste que falha
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

const { migrar } = await import('../src/js/backend/migracoes.js');
migrar(db);

const { criarContexto, criarConta } = await import('../src/js/backend/core/financeiro.js');
const cid = criarContexto(db, { nome: 'C' });
const cb = criarConta(db, { contextoId: cid, nome: 'BB', tipo: 'bancaria' });
const contaCartao = criarConta(db, { contextoId: cid, nome: 'Cartao Nubank', tipo: 'cartao' });

db.run(`INSERT INTO cartoes (contexto_id, nome, dia_fechamento, dia_vencimento, limite_centavos, conta_pagamento_id, conta_associada_id) VALUES (?, 'Nubank', 5, 15, 100000, ?, ?)`,
  [cid, cb, contaCartao]);
const cartaoId = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
console.log('cartaoId:', cartaoId);

for (let i = 1; i <= 3; i++) {
  const d = String(i + 7).padStart(2, '0');
  db.run(`INSERT INTO lancamentos (contexto_id, conta_id, cartao_id, natureza, valor_centavos, data_competencia, descricao, status, criado_em) VALUES (?, ?, ?, 'despesa', 25000, '2026-${d}-11', ?, 'aberto', '2026-08-14 10:00:00')`,
    [cid, contaCartao, cartaoId, `Amazon - Parcela ${i}/3`]);
}

const { abrirFatura, pagarFatura } = await import('../src/js/backend/core/cartoes.js');
const faturaId1 = abrirFatura(db, { cartaoId, ciclo: '2026-08', dataFechamento: '2026-08-05', dataVencimento: '2026-08-15' });
const faturaId2 = abrirFatura(db, { cartaoId, ciclo: '2026-09', dataFechamento: '2026-09-05', dataVencimento: '2026-09-15' });
const faturaId3 = abrirFatura(db, { cartaoId, ciclo: '2026-10', dataFechamento: '2026-10-05', dataVencimento: '2026-10-15' });
console.log('faturas:', faturaId1, faturaId2, faturaId3);

// Paga as 2 primeiras
try {
  pagarFatura(db, { faturaId: faturaId1, contaPagamentoId: cb, dataPagamento: '2026-08-15' });
  console.log('Paga fatura 1 OK');
  pagarFatura(db, { faturaId: faturaId2, contaPagamentoId: cb, dataPagamento: '2026-09-15' });
  console.log('Paga fatura 2 OK');
} catch (e) {
  console.log('Erro pagarFatura:', e.message);
  console.log(e.stack);
}

const { detectarParcelamentosDoExtrato, criarParcelamentosDetectados } = await import('../src/js/backend/core/parcelamentos.js');
const det = detectarParcelamentosDoExtrato(db, cid, cartaoId);
console.log('det:', det);
try {
  const r = criarParcelamentosDetectados(db, cid, cartaoId, [det[0]]);
  console.log('r:', r);
} catch (e) {
  console.log('Erro criarParcelamentosDetectados:', e.message);
  console.log(e.stack);
}
