// Debug: testa o parser OFX atual no arquivo do Marcio
import { parsearOFX } from '../src/js/backend/core/importacao.js';
import fs from 'node:fs';

const arq = process.argv[2];
if (!arq) { console.error('uso: node debug-ofx-nubank.mjs <arquivo.ofx>'); process.exit(1); }

const conteudo = fs.readFileSync(arq, 'utf8');
const txs = parsearOFX(conteudo);
console.log('Total de transacoes:', txs.length);
console.log('Primeiras 5:');
for (const t of txs.slice(0, 5)) {
  console.log('  ', t.data_transacao, t.valor_centavos, t.descricao.slice(0, 60));
}
console.log();
console.log('Natureza:');
const desp = txs.filter(t => t.valor_centavos < 0).length;
const rec = txs.filter(t => t.valor_centavos > 0).length;
console.log('  despesas:', desp, '  receitas:', rec);
console.log();
console.log('CONTEXTO:');
console.log('  Esse OFX tem header <BANKACCTFROM> com ACCTTYPE=CHECKING?',
  /<ACCTTYPE>CHECKING/i.test(conteudo) ? 'SIM' : 'NAO');
console.log('  Tem FITID tipo cartao (CREDIT_CARD)?',
  /<ACCTTYPE>CREDITCARD/i.test(conteudo) ? 'SIM' : 'NAO');
console.log('  Total do periodo:', txs.reduce((s, t) => s + t.valor_centavos, 0) / 100);
