// MLopes Finance — importacao de extratos OFX e CSV
// Fluxo: parse → previa → confirmar (cria lancamentos com chave_externa para evitar duplicidade)

import { criarLancamento } from './lancamentos.js';

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return (h >>> 0).toString(16);
}

/** Parser OFX minimo (extrato bancario simples, suporta SGML e XML). */
export function parsearOFX(texto) {
  const transacoes = [];
  // OFX SGML usa <STMTTRN>...<TRNTYPE>...<DTPOSTED>...<TRNAMT>...<NAME>...<MEMO>...</STMTTRN>
  // OFX XML/2.x usa o mesmo formato. Tags SGML (sem < > nos valores) sao aceitas tambem.
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  for (const bloco of blocos) {
    const fim = bloco.search(/<\/STMTTRN>/i);
    const corpo = fim >= 0 ? bloco.substring(0, fim) : bloco;
    // Acept tanto <TAG>valor quanto TAG:valor
    const pickTag = (tag) => {
      const m1 = corpo.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
      if (m1) return m1[1].trim();
      const m2 = corpo.match(new RegExp(`^${tag}:(.+)$`, 'mi'));
      if (m2) return m2[1].trim();
      return null;
    };
    const tipo = pickTag('TRNTYPE');
    const dataStr = pickTag('DTPOSTED');
    const valorStr = pickTag('TRNAMT');
    const descricao = pickTag('NAME') || pickTag('MEMO') || 'Sem descricao';
    const fitid = pickTag('FITID');
    if (!dataStr || !valorStr) continue;
    // Data: aceita YYYYMMDD ou YYYYMMDDHHMMSS ou variantes
    const dMatch = dataStr.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!dMatch) continue;
    const dataISO = `${dMatch[1]}-${dMatch[2]}-${dMatch[3]}`;
    const valor = Math.abs(parseFloat(valorStr.replace(',', '.')));
    if (isNaN(valor)) continue;
    const valorCentavos = Math.round(valor * 100);
    const fitidFinal = fitid || `${dataISO}|${valorCentavos}|${descricao}`;
    transacoes.push({
      data_transacao: dataISO,
      valor_centavos: valorCentavos,
      descricao,
      chave_externa: hashString(fitidFinal),
      tipo_ofx: tipo || 'OUTROS',
    });
  }
  return transacoes;
}

/** Parser CSV simples: primeira linha é header, detecta colunas por nome. */
export function parsearCSV(texto, mapeamento = null) {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (linhas.length < 2) return [];
  const delim = linhas[0].includes(';') ? ';' : (linhas[0].includes('\t') ? '\t' : ',');
  const cabecalho = linhas[0].split(delim).map(c => c.trim().toLowerCase().replace(/^"|"$/g, ''));
  // Mapeamento default: tenta achar colunas por nome
  const map = mapeamento || autoMapearCSV(cabecalho);
  if (map.data < 0 || map.valor < 0 || map.descricao < 0) throw new Error('CSV sem colunas de data, valor ou descricao. Informe o mapeamento manualmente.');
  const transacoes = [];
  for (let i = 1; i < linhas.length; i++) {
    const campos = parsearLinhaCSV(linhas[i], delim);
    const data = campos[map.data];
    const valorStr = (campos[map.valor] || '0').replace(/[^\d.,-]/g, '').replace(',', '.');
    const valor = parseFloat(valorStr);
    if (isNaN(valor) || valor === 0) continue;
    const descricao = (campos[map.descricao] || '').trim() || `Linha ${i + 1}`;
    const dataISO = normalizarData(data);
    if (!dataISO) continue;
    transacoes.push({
      data_transacao: dataISO,
      valor_centavos: Math.round(Math.abs(valor) * 100),
      descricao,
      chave_externa: hashString(`${dataISO}|${Math.round(Math.abs(valor) * 100)}|${descricao}`),
      natureza_sugerida: valor < 0 ? 'despesa' : 'receita',
    });
  }
  return transacoes;
}

function autoMapearCSV(cabecalho) {
  const map = { data: -1, valor: -1, descricao: -1 };
  for (let i = 0; i < cabecalho.length; i++) {
    const c = cabecalho[i];
    if (map.data < 0 && /data|date|dt|posted|when/i.test(c)) map.data = i;
    if (map.valor < 0 && /valor|value|amount|amt|montante/i.test(c)) map.valor = i;
    if (map.descricao < 0 && /desc|description|hist|memo|name|narration/i.test(c)) map.descricao = i;
  }
  return map;
}

function parsearLinhaCSV(linha, delim) {
  const campos = [];
  let atual = '';
  let emAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') { emAspas = !emAspas; continue; }
    if (c === delim && !emAspas) { campos.push(atual); atual = ''; continue; }
    atual += c;
  }
  campos.push(atual);
  return campos.map(c => c.trim());
}

function normalizarData(data) {
  if (!data) return null;
  const d = data.trim();
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  // dd/mm/yyyy
  let m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // dd-mm-yyyy
  m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // yyyymmdd
  m = d.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** Cria a importacao em status 'previa' e insere os itens. Retorna id da importacao. */
export function criarPreviaImportacao(db, { contextoId, arquivoOrigem, formato, conteudo, mapeamentoCsv = '' }) {
  if (!contextoId || !arquivoOrigem || !formato || !conteudo) throw new Error('Parametros obrigatorios ausentes.');
  let itens;
  if (formato === 'ofx') itens = parsearOFX(conteudo);
  else if (formato === 'csv') {
    const mapa = mapeamentoCsv ? JSON.parse(mapeamentoCsv) : null;
    itens = parsearCSV(conteudo, mapa);
  } else throw new Error(`Formato nao suportado: ${formato}`);
  if (itens.length === 0) throw new Error('Arquivo vazio ou sem transacoes reconheciveis.');
  const hash = hashString(conteudo);
  // Verifica se ja foi importado
  const dup = db.exec('SELECT id FROM importacoes WHERE hash_arquivo = ? AND contexto_id = ? AND status = ?', [hash, contextoId, 'confirmada'])[0]?.values?.[0]?.[0];
  if (dup) throw new Error(`Este arquivo ja foi importado (importacao #${dup}). Reimportacao bloqueada.`);
  db.run(`INSERT INTO importacoes (contexto_id, arquivo_origem, formato, hash_arquivo, total_registros, mapeamento_csv, status) VALUES (?, ?, ?, ?, ?, ?, 'previa')`,
    [contextoId, arquivoOrigem, formato, hash, itens.length, mapeamentoCsv]);
  const idImport = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
  for (const it of itens) {
    db.run(`INSERT INTO itens_importacao (importacao_id, conta_id, data_transacao, valor_centavos, descricao, chave_externa) VALUES (?, NULL, ?, ?, ?, ?)`,
      [idImport, it.data_transacao, it.valor_centavos, it.descricao, it.chave_externa]);
  }
  // Detecta duplicados contra lancamentos ja existentes (mesma data + valor + descricao)
  for (const it of db.exec('SELECT id, data_transacao, valor_centavos, descricao FROM itens_importacao WHERE importacao_id = ?', [idImport])[0]?.values ?? []) {
    const dupLanc = db.exec(
      'SELECT id FROM lancamentos WHERE contexto_id = ? AND data_competencia = ? AND valor_centavos = ? AND descricao = ? LIMIT 1',
      [contextoId, it[1], it[2], it[3]]
    )[0]?.values?.[0]?.[0];
    if (dupLanc) {
      db.run("UPDATE itens_importacao SET status = 'duplicado' WHERE id = ?", [it[0]]);
    }
  }
  return idImport;
}

/** Define a conta de destino e confirma a importacao. Cria lancamentos. */
export function confirmarImportacao(db, { importacaoId, contaId, padraoNatureza = 'despesa' }, agora = new Date().toISOString()) {
  if (!Number.isInteger(importacaoId) || !Number.isInteger(contaId)) throw new Error('importacaoId e contaId obrigatorios.');
  const itens = db.exec("SELECT id, data_transacao, valor_centavos, descricao FROM itens_importacao WHERE importacao_id = ? AND status = 'pendente'", [importacaoId])[0]?.values ?? [];
  if (!itens.length) throw new Error('Nenhum item pendente para importar.');
  let importados = 0;
  db.run('BEGIN');
  try {
    for (const [id, data, valor, descricao] of itens) {
      const natureza = valor < 0 ? 'despesa' : (padraoNatureza === 'receita' ? 'receita' : 'despesa');
      const idLanc = criarLancamento(db, {
        contextoId: Number(db.exec('SELECT contexto_id FROM importacoes WHERE id = ?', [importacaoId])[0].values[0][0]),
        contaId, natureza,
        valorCentavos: Math.abs(valor), dataCompetencia: data, descricao,
      }, agora);
      db.run("UPDATE itens_importacao SET status = 'importado', lancamento_id = ?, conta_id = ? WHERE id = ?", [idLanc, contaId, id]);
      importados++;
    }
    db.run("UPDATE importacoes SET status = 'confirmada', total_importados = ? WHERE id = ?", [importados, importacaoId]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { importados };
}

export function listarImportacoes(db, contextoId) {
  if (!Number.isInteger(contextoId)) return [];
  return db.exec('SELECT * FROM importacoes WHERE contexto_id = ? ORDER BY criado_em DESC', [contextoId])[0]?.values ?? [];
}

export function cancelarImportacao(db, importacaoId) {
  db.run("UPDATE importacoes SET status = 'cancelada' WHERE id = ?", [importacaoId]);
  db.run("UPDATE itens_importacao SET status = 'ignorado' WHERE importacao_id = ? AND status = 'pendente'", [importacaoId]);
  return true;
}
