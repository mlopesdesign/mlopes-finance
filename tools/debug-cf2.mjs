import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrar } from '../src/js/backend/migracoes.js';
import { criarContexto, criarConta } from '../src/js/backend/core/financeiro.js';
import { criarCustoFixo, listarCustosFixos } from '../src/js/backend/core/custosFixos.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wasmPath = path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm');
const schemaPath = path.join(root, 'src/js/backend/schema.sql');
const SQL = await initSqlJs({ locateFile: () => wasmPath });
const db = new SQL.Database();
db.exec(fs.readFileSync(schemaPath, 'utf8'));
migrar(db);
const cid = criarContexto(db, { nome: 'C' });
const cb = criarConta(db, { contextoId: cid, nome: 'BB', tipo: 'bancaria' });
criarCustoFixo(db, { contextoId: cid, descricao: 'Aluguel', valorCentavos: 150000, contaId: cb, diaDoMes: 10 });

console.log('=== QUERY DE LISTAGEM ===');
const q = `
    SELECT r.id AS recorrenciaId, r.ativa, r.proxima_geracao, r.criado_em,
           l.id AS templateId, l.descricao, l.valor_centavos, l.conta_id, l.categoria_id,
           c.nome AS conta_nome, c.tipo AS conta_tipo,
           ca.nome AS categoria_nome
    FROM recorrencias r
    JOIN lancamentos l ON l.id = r.lancamento_template_id
    LEFT JOIN contas c ON c.id = l.conta_id
    LEFT JOIN categorias ca ON ca.id = l.categoria_id
    WHERE r.contexto_id = ? AND r.periodicidade = 'mensal' AND l.descricao LIKE '%[custo fixo]%'
    ORDER BY l.descricao
`;
const r = db.exec(q, [cid]);
console.log('Resultado:', r);

console.log('=== MESMA QUERY SEM FILTRO DE DESCRICAO ===');
const q2 = `
    SELECT r.id AS recorrenciaId, r.ativa, l.descricao
    FROM recorrencias r
    JOIN lancamentos l ON l.id = r.lancamento_template_id
    WHERE r.contexto_id = ? AND r.periodicidade = 'mensal'
`;
const r2 = db.exec(q2, [cid]);
console.log('Resultado:', r2);
