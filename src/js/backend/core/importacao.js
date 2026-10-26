// MLopes Finance — importacao de extratos OFX e CSV
// Fluxo: parse → previa → confirmar (cria lancamentos com chave_externa para evitar duplicidade)

import { criarLancamento } from './lancamentos.js';
import { criarCategoria } from './financeiro.js';
import { detectarParcelamentosDoExtrato, criarParcelamentosDetectados } from './parcelamentos.js';
import { regularizarHistoricoCartoes } from './cartoes.js';

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
    const valor = parseNumeroFinanceiro(valorStr);
    if (isNaN(valor)) continue;
    // Preserva o sinal: < 0 = debito/despesa, > 0 = credito/receita.
    const valorCentavos = Math.round(valor * 100);
    // A regra de duplicidade do produto e' data + valor + descricao.
    // FITID varia entre exportacoes e nao pode permitir a mesma transacao 2x.
    const chaveRegra = `${dataISO}|${Math.abs(valorCentavos)}|${descricao}`;
    transacoes.push({
      data_transacao: dataISO,
      valor_centavos: valorCentavos,
      descricao,
      chave_externa: hashString(chaveRegra),
      tipo_ofx: tipo || 'OUTROS',
      natureza_sugerida: valor < 0 ? 'despesa' : 'receita',
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
  if (map.data < 0 || (map.valor < 0 && (map.debito < 0 || map.credito < 0)) || map.descricao < 0) throw new Error('CSV sem colunas de data, valor ou descricao. Informe o mapeamento manualmente.');
  const transacoes = [];
  for (let i = 1; i < linhas.length; i++) {
    const campos = parsearLinhaCSV(linhas[i], delim);
    const data = campos[map.data];
    const valor = map.valor >= 0
      ? parseNumeroFinanceiro(campos[map.valor])
      : (parseNumeroFinanceiro(campos[map.credito]) || 0) - (parseNumeroFinanceiro(campos[map.debito]) || 0);
    if (isNaN(valor) || valor === 0) continue;
    const descricao = (campos[map.descricao] || '').trim() || `Linha ${i + 1}`;
    const dataISO = normalizarData(data);
    if (!dataISO) continue;
    // Preserva o sinal: < 0 = despesa, > 0 = receita.
    const valorCentavos = Math.round(valor * 100);
    transacoes.push({
      data_transacao: dataISO,
      valor_centavos: valorCentavos,
      descricao,
      chave_externa: hashString(`${dataISO}|${Math.abs(valorCentavos)}|${descricao}`),
      natureza_sugerida: valor < 0 ? 'despesa' : 'receita',
    });
  }
  return transacoes;
}

function autoMapearCSV(cabecalho) {
  const map = { data: -1, valor: -1, debito: -1, credito: -1, descricao: -1 };
  for (let i = 0; i < cabecalho.length; i++) {
    const c = cabecalho[i];
    if (map.data < 0 && /data|date|dt|posted|when/i.test(c)) map.data = i;
    if (map.valor < 0 && /valor|value|amount|amt|montante|saldo/i.test(c) && !/debito|d[eé]bito|credito|cr[eé]dito/i.test(c)) map.valor = i;
    if (map.debito < 0 && /debito|d[eé]bito|debit|sa[ií]da/i.test(c)) map.debito = i;
    if (map.credito < 0 && /credito|cr[eé]dito|credit|entrada/i.test(c)) map.credito = i;
    if (map.descricao < 0 && /desc|description|hist|memo|name|narration/i.test(c)) map.descricao = i;
  }
  return map;
}

function parseNumeroFinanceiro(valor) {
  let s = String(valor ?? '').trim().replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  const negativo = s.startsWith('-');
  s = s.replace(/-/g, '');
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negativo ? -n : n;
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
  // v0.8.20: Bloqueia reimportacao se ja existe QUALQUER importacao anterior (mesmo
  // 'previa' ou 'cancelada') com o mesmo hash+contexto. Antes so bloqueava
  // 'confirmada', o que permitia duplicacao de arquivos que ficaram orfaos apos
  // excluir todos os lancamentos (deixava 2x o mesmo arquivo no banco).
  // Para forcar uma nova previa, o usuario precisa EXCLUIR a importacao anterior
  // pelo botao "Excluir" do historico.
  const dup = db.exec('SELECT id, status FROM importacoes WHERE hash_arquivo = ? AND contexto_id = ?', [hash, contextoId])[0]?.values?.[0];
  if (dup) {
    const idDup = dup[0];
    const statusDup = dup[1];
    throw new Error(`Este arquivo ja tem uma importacao (#${idDup}, status=${statusDup}) neste contexto. Exclua a anterior pelo historico para criar uma nova previa.`);
  }
  db.run(`INSERT INTO importacoes (contexto_id, arquivo_origem, formato, hash_arquivo, total_registros, mapeamento_csv, status) VALUES (?, ?, ?, ?, ?, ?, 'previa')`,
    [contextoId, arquivoOrigem, formato, hash, itens.length, mapeamentoCsv]);
  const idImport = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
  // Dedup DENTRO do arquivo: linhas com mesma chave_externa (data+valor+descricao)
  // sao a mesma transacao listada 2x pelo banco. O UNIQUE(importacao_id, chave_externa)
  // impede inserir 2 com a mesma chave, entao a dedup tem que ser ANTES do INSERT.
  // As duplicatas internas nao sao inseridas (a UI lista os pendentes e ja tem
  // mecanismo pra detectar duplicatas contra lancamentos existentes).
  const seen = new Set();
  const itensUnicos = [];
  for (const it of itens) {
    if (seen.has(it.chave_externa)) continue;
    seen.add(it.chave_externa);
    itensUnicos.push(it);
  }
  // INSERT OR IGNORE por seguranca (se dois processos importarem o mesmo arquivo ao
  // mesmo tempo, o UNIQUE faz o segundo ser ignorado em vez de explodir).
  for (const it of itensUnicos) {
    db.run(`INSERT OR IGNORE INTO itens_importacao (importacao_id, conta_id, data_transacao, valor_centavos, descricao, chave_externa) VALUES (?, NULL, ?, ?, ?, ?)`,
      [idImport, it.data_transacao, it.valor_centavos, it.descricao, it.chave_externa]);
  }
  // Detecta duplicados contra lancamentos ja existentes (mesma data + valor absoluto + descricao).
  // valor_centavos no item pode ser negativo (despesa) mas no lancamento e' sempre positivo
  // (schema CHECK valor_centavos > 0), entao comparamos via Math.abs no JS.
  for (const it of db.exec('SELECT id, data_transacao, valor_centavos, descricao FROM itens_importacao WHERE importacao_id = ?', [idImport])[0]?.values ?? []) {
    const candidatos = db.exec(
      'SELECT id, valor_centavos FROM lancamentos WHERE contexto_id = ? AND data_competencia = ? AND descricao = ?',
      [contextoId, it[1], it[3]]
    )[0]?.values ?? [];
    const valorAbs = Math.abs(it[2]);
    const dupLanc = candidatos.find((l) => l[1] === valorAbs);
    if (dupLanc) {
      db.run("UPDATE itens_importacao SET status = 'duplicado' WHERE id = ?", [it[0]]);
    }
  }
  return idImport;
}

/**
 * Infere a natureza (receita|despesa) de um item de importacao baseado em heuristicas:
 * 1. Sinal do valor (negativo = despesa, positivo = receita) - regra de ouro
 * 2. Tipo da conta: cartao de credito = SEMPRE despesa (mesmo valor positivo)
 * 3. Palavras-chave na descricao (so aplicam se o sinal for ambiguo, ex: 0 ou
 *    valor positivo num extrato de cartao)
 * 4. Fallback: padraoNatureza do user (default 'despesa')
 *
 * Retorna { natureza, motivo } pra UI mostrar pro user o que inferiu.
 */
export function inferirNaturezaItem({ descricao = '', valor = 0, contaTipo = 'bancaria', contaNome = '', padraoNatureza = 'despesa' }) {
  const desc = String(descricao).toUpperCase();
  // Regras fortes: tipo da conta
  if (contaTipo === 'cartao') {
    return { natureza: 'despesa', motivo: 'conta = cartão de crédito' };
  }
  // Palavras-chave de despesa (fortes)
  const kwDespesa = ['PAGAMENTO', 'PAGTO', 'BOLETO', 'COMPRA', 'DEBITO', 'DÉBITO', 'TARIFA',
                     'IOF', 'JUROS', 'MULTA', 'ANUIDADE', 'MENSALIDADE', 'SAQUE'];
  for (const kw of kwDespesa) {
    if (desc.includes(kw)) return { natureza: 'despesa', motivo: `descrição contém "${kw}"` };
  }
  // Palavras-chave de receita (fortes)
  const kwReceita = ['RECEBIDO', 'RECEB', 'CRED', 'CRÉD', 'PIX RECEB', 'TRANSF RECEB',
                    'DEPÓSITO', 'DEPOSITO', 'SALÁRIO', 'SALARIO', 'RENDIMENTO',
                    'ALUGUEL RECEB', 'PIX RECEBIDO', 'TED RECEB', 'DOC RECEB'];
  for (const kw of kwReceita) {
    if (desc.includes(kw)) return { natureza: 'receita', motivo: `descrição contém "${kw}"` };
  }
  // Sem keyword: usa o sinal do valor
  if (valor < 0) return { natureza: 'despesa', motivo: 'valor negativo' };
  if (valor > 0) {
    // Valor positivo: depende do tipo de conta
    if (contaTipo === 'investimento') {
      // Investimento: aplicacao = despesa (voce investiu); resgate = receita
      if (kwDespesa.some(kw => desc.includes(kw))) return { natureza: 'despesa', motivo: 'investimento + aplicacao' };
      return { natureza: 'receita', motivo: 'investimento + valor positivo (assume resgate)' };
    }
    return { natureza: padraoNatureza, motivo: 'sem palavra-chave, usando padrão' };
  }
  return { natureza: padraoNatureza, motivo: 'valor zero, usando padrão' };
}

const REGRAS_CATEGORIA_AUTOMATICA = [
  { nome: 'Salário', natureza: 'receita', termos: ['SALARIO', 'SALÁRIO', 'FOLHA', 'PAGAMENTO DE SALARIO', 'PRO LABORE', 'PRO-LABORE'] },
  { nome: 'Receitas', natureza: 'receita', termos: ['RECEBIDO', 'RECEB', 'CREDITO', 'CRÉDITO', 'PIX RECEB', 'TRANSFERENCIA RECEB', 'TED RECEB', 'DOC RECEB', 'DEPOSITO', 'DEPÓSITO', 'RENDIMENTO'] },
  { nome: 'Alimentação', natureza: 'despesa', termos: ['IFOOD', 'RESTAURANTE', 'LANCHONETE', 'PADARIA', 'MERCADO', 'SUPERMERCADO', 'IFOOD', 'RAPPI'] },
  { nome: 'Moradia', natureza: 'despesa', termos: ['ALUGUEL', 'CONDOMINIO', 'CONDOMÍNIO', 'ENERGIA', 'LUZ', 'AGUA', 'ÁGUA', 'GAS', 'GÁS', 'VIVO', 'CLARO', 'TIM', 'OI', 'INTERNET'] },
  { nome: 'Transporte', natureza: 'despesa', termos: ['UBER', '99APP', 'COMBUSTIVEL', 'COMBUSTÍVEL', 'POSTO', 'ESTACIONAMENTO', 'PEDAGIO', 'PEDÁGIO', 'METRO', 'ÔNIBUS', 'ONIBUS'] },
  { nome: 'Saúde', natureza: 'despesa', termos: ['FARMACIA', 'FARMÁCIA', 'DROGARIA', 'HOSPITAL', 'CLINICA', 'CLÍNICA', 'MEDICO', 'MÉDICO', 'PLANO DE SAUDE', 'PLANO DE SAÚDE'] },
  { nome: 'Eletrônicos', natureza: 'despesa', termos: ['CELULAR', 'IPHONE', 'SMARTPHONE', 'NOTEBOOK', 'COMPUTADOR', 'ELETRONICO', 'ELETRÔNICO', 'AMAZON', 'KABUM', 'MAGALU', 'MAGAZINE LUIZA'] },
  { nome: 'Educação', natureza: 'despesa', termos: ['ESCOLA', 'FACULDADE', 'CURSO', 'UDEMY', 'LIVRARIA', 'EDUCACAO', 'EDUCAÇÃO'] },
  { nome: 'Assinaturas', natureza: 'despesa', termos: ['NETFLIX', 'SPOTIFY', 'GOOGLE *', 'APPLE.COM', 'MICROSOFT', 'ADOBE', 'ASSINATURA'] },
  { nome: 'Tarifas e impostos', natureza: 'despesa', termos: ['TARIFA', 'IOF', 'JUROS', 'MULTA', 'ANUIDADE', 'IMPOSTO', 'ISS', 'DARF', 'DAS'] },
  { nome: 'Transferências', natureza: 'ambas', termos: ['TRANSFERENCIA ENTRE', 'TRANSFERÊNCIA ENTRE', 'TRANSF ENTRE', 'TED ENTRE', 'DOC ENTRE'] },
];

function textoBusca(descricao) {
  return String(descricao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Classifica e garante uma categoria sem exigir cadastro manual. */
export function classificarCategoriaAutomatica(db, contextoId, descricao, natureza) {
  const texto = textoBusca(descricao);
  const regra = REGRAS_CATEGORIA_AUTOMATICA.find((r) => r.termos.some((termo) => texto.includes(textoBusca(termo))));
  const nome = regra && (regra.natureza === natureza || regra.natureza === 'ambas')
    ? regra.nome
    : natureza === 'receita' ? 'Outras receitas' : 'Outras despesas';
  const naturezaCategoria = regra?.natureza === 'ambas' ? 'ambas' : natureza;
  const existente = db.exec(
    `SELECT id FROM categorias WHERE contexto_id = ? AND LOWER(nome) = LOWER(?) AND natureza IN (?, 'ambas') LIMIT 1`,
    [contextoId, nome, naturezaCategoria]
  )[0]?.values?.[0]?.[0];
  if (existente != null) return { categoriaId: Number(existente), categoriaNome: nome, regra: regra?.nome || 'fallback' };
  const categoriaId = criarCategoria(db, { contextoId, nome, natureza: naturezaCategoria });
  return { categoriaId: Number(categoriaId), categoriaNome: nome, regra: regra?.nome || 'fallback' };
}

function resolverContaAutomatica(db, { contextoId, contaId = null, arquivoOrigem = '' }) {
  if (contaId != null) {
    const conta = db.exec('SELECT id, nome, tipo FROM contas WHERE id = ? AND contexto_id = ? AND ativo = 1', [contaId, contextoId])[0]?.values?.[0];
    if (!conta) throw new Error('Conta selecionada nao pertence ao contexto ou esta inativa.');
    return { id: Number(conta[0]), nome: String(conta[1]), tipo: String(conta[2]), origem: 'selecionada' };
  }
  const contas = db.exec('SELECT id, nome, tipo FROM contas WHERE contexto_id = ? AND ativo = 1 ORDER BY nome', [contextoId])[0]?.values ?? [];
  if (contas.length === 1) return { id: Number(contas[0][0]), nome: String(contas[0][1]), tipo: String(contas[0][2]), origem: 'conta-unica' };
  const arquivo = textoBusca(arquivoOrigem);
  const candidatas = contas.filter((c) => {
    const nome = textoBusca(c[1]);
    return nome && (arquivo.includes(nome) || nome.includes(arquivo.replace(/\.[^.]+$/, '')));
  });
  if (candidatas.length === 1) return { id: Number(candidatas[0][0]), nome: String(candidatas[0][1]), tipo: String(candidatas[0][2]), origem: 'nome-do-arquivo' };
  throw new Error('Nao foi possivel identificar automaticamente a conta deste extrato. Renomeie o arquivo com o nome da conta ou informe a conta uma vez.');
}

/** Define a conta de destino e confirma a importacao. Cria lancamentos. */
export function confirmarImportacao(db, { importacaoId, contaId, padraoNatureza = 'despesa', automatizarCategorias = false, statusImportado = 'aberto' }, agora = new Date().toISOString()) {
  if (!Number.isInteger(importacaoId) || !Number.isInteger(contaId)) throw new Error('importacaoId e contaId obrigatorios.');
  // Busca dados da conta pra inferir natureza (tipo + nome)
  const conta = db.exec('SELECT id, nome, tipo FROM contas WHERE id = ?', [contaId])[0]?.values?.[0];
  if (!conta) throw new Error('Conta nao encontrada.');
  const contaNome = String(conta[1] || '');
  const contaTipo = String(conta[2] || 'bancaria');
  const itens = db.exec("SELECT id, data_transacao, valor_centavos, descricao FROM itens_importacao WHERE importacao_id = ? AND status = 'pendente'", [importacaoId])[0]?.values ?? [];
  if (!itens.length) throw new Error('Nenhum item pendente para importar.');
  let importados = 0;
  const inferencias = []; // [{itemId, natureza, motivo}] pra UI mostrar
  db.run('BEGIN');
  try {
    for (const [id, data, valor, descricao] of itens) {
      // Infere natureza automaticamente (sem perguntar pro user)
      const { natureza, motivo } = inferirNaturezaItem({
        descricao, valor, contaTipo, contaNome, padraoNatureza,
      });
      inferencias.push({ itemId: id, natureza, motivo });
      const contextoId = Number(db.exec('SELECT contexto_id FROM importacoes WHERE id = ?', [importacaoId])[0].values[0][0]);
      const categoria = automatizarCategorias ? classificarCategoriaAutomatica(db, contextoId, descricao, natureza) : null;
      const idLanc = criarLancamento(db, {
        contextoId, contaId, natureza, categoriaId: categoria?.categoriaId ?? null,
        valorCentavos: Math.abs(valor), dataCompetencia: data, descricao,
        status: statusImportado,
      }, agora);
      db.run("UPDATE itens_importacao SET status = 'importado', lancamento_id = ?, conta_id = ? WHERE id = ?", [idLanc, contaId, id]);
      importados++;
      inferencias[inferencias.length - 1].categoria = categoria?.categoriaNome || null;
    }
    db.run("UPDATE importacoes SET status = 'confirmada', total_importados = ? WHERE id = ?", [importados, importacaoId]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { importados, inferencias };
}

/**
 * Importa um extrato sem etapa de confirmacao manual quando a conta pode ser resolvida.
 * Tambem cria categorias e transforma padroes de parcela em parcelamentos completos.
 */
export function importarAutomaticamente(db, { importacaoId, contaId = null, padraoNatureza = 'despesa' }, agora = new Date().toISOString()) {
  if (!Number.isInteger(importacaoId)) throw new Error('importacaoId obrigatorio.');
  const imp = db.exec('SELECT contexto_id, arquivo_origem FROM importacoes WHERE id = ?', [importacaoId])[0]?.values?.[0];
  if (!imp) throw new Error('Importacao nao encontrada.');
  const conta = resolverContaAutomatica(db, { contextoId: Number(imp[0]), contaId, arquivoOrigem: imp[1] });
  const out = confirmarImportacao(db, { importacaoId, contaId: conta.id, padraoNatureza, automatizarCategorias: true, statusImportado: 'conciliado' }, agora);
  let parcelamentos = [];
  const cartao = db.exec('SELECT id FROM cartoes WHERE contexto_id = ? AND conta_associada_id = ? AND ativo = 1', [imp[0], conta.id])[0]?.values?.[0];
  if (cartao) {
    const candidatos = detectarParcelamentosDoExtrato(db, Number(imp[0]), Number(cartao[0]));
    parcelamentos = criarParcelamentosDetectados(db, Number(imp[0]), Number(cartao[0]), candidatos);
  }
  const cartoesRegularizados = regularizarHistoricoCartoes(db, { contextoId: Number(imp[0]) });
  return { ...out, conta: { id: conta.id, nome: conta.nome, tipo: conta.tipo, origem: conta.origem }, parcelamentos, cartoesRegularizados };
}

export function listarImportacoes(db, contextoId) {
  if (!Number.isInteger(contextoId)) return [];
  return db.exec('SELECT * FROM importacoes WHERE contexto_id = ? ORDER BY criado_em DESC', [contextoId])[0]?.values ?? [];
}

/**
 * v0.8.20: Recicla uma importacao "morta" — marca TODOS os itens 'ignorado' ou
 * 'duplicado' como 'pendente' para que possam ser confirmados novamente.
 *
 * Caso de uso: o usuario excluiu todos os lancamentos de uma importacao
 * confirmada, e o sistema marcou os 63+ itens como 'ignorado' (regra do
 * lifecycle). Sem este caminho, o usuario nao tinha como re-confirmar a mesma
 * importacao — tinha que excluir a importacao inteira e reimportar do zero.
 *
 * NUNCA altera o status da importacao (continua 'previa'/'confirmada'/'cancelada').
 * Retorna { ok, reciclados, status, mensagem }.
 */
export function reciclarImportacao(db, importacaoId) {
  if (!Number.isInteger(importacaoId)) throw new Error('importacaoId obrigatorio.');
  const imp = db.exec('SELECT id, status FROM importacoes WHERE id = ?', [importacaoId])[0]?.values?.[0];
  if (!imp) throw new Error('Importacao nao encontrada.');
  // Conta quantos serao reciclados (so 'ignorado' e 'duplicado' — 'pendente' nao precisa,
  // 'importado' e intocavel pq ja tem lancamento vinculado).
  const contadores = db.exec(
    "SELECT status, COUNT(*) FROM itens_importacao WHERE importacao_id = ? GROUP BY status",
    [importacaoId]
  )[0]?.values ?? [];
  const ignorados = contadores.find((c) => c[0] === 'ignorado')?.[1] ?? 0;
  const duplicados = contadores.find((c) => c[0] === 'duplicado')?.[1] ?? 0;
  const reciclaveis = ignorados + duplicados;
  if (reciclaveis === 0) {
    return { ok: true, reciclados: 0, status: imp[1], mensagem: 'Nada para reciclar (sem itens ignorados/duplicados).' };
  }
  db.run("UPDATE itens_importacao SET status = 'pendente' WHERE importacao_id = ? AND status IN ('ignorado', 'duplicado')", [importacaoId]);
  return {
    ok: true,
    reciclados: reciclaveis,
    status: imp[1],
    mensagem: `${reciclaveis} item(ns) marcados como pendente (${ignorados} ignorado, ${duplicados} duplicado). Agora voce pode confirmar a importacao.`,
  };
}

export function cancelarImportacao(db, importacaoId) {
  db.run("UPDATE importacoes SET status = 'cancelada' WHERE id = ?", [importacaoId]);
  db.run("UPDATE itens_importacao SET status = 'ignorado' WHERE importacao_id = ? AND status = 'pendente'", [importacaoId]);
  return true;
}

/** Exclui a importacao (e cascade os itens_importacao). Lancamentos permanecem. */
export function excluirImportacao(db, importacaoId) {
  if (!Number.isInteger(importacaoId)) throw new Error('importacaoId obrigatorio.');
  const r = db.exec('SELECT id, status FROM importacoes WHERE id = ?', [importacaoId])[0]?.values?.[0];
  if (!r) throw new Error('Importacao nao encontrada.');
  // v0.8.20: sql.js NAO enforca FK ON DELETE CASCADE por padrao (precisa
  // PRAGMA foreign_keys = ON que nao habilitamos). Se a gente confiasse so
  // no DELETE da importacao, os 63+ itens_importacao ficariam orfaos no banco
  // (FK violation silenciosa). Faz DELETE manual primeiro pra garantir.
  const itensAntes = db.exec('SELECT COUNT(*) FROM itens_importacao WHERE importacao_id = ?', [importacaoId])[0]?.values?.[0]?.[0] ?? 0;
  db.run('DELETE FROM itens_importacao WHERE importacao_id = ?', [importacaoId]);
  db.run('DELETE FROM importacoes WHERE id = ?', [importacaoId]);
  return { ok: true, id: importacaoId, statusAnterior: r[1], itensRemovidos: itensAntes };
}

/**
 * Exclui os lancamentos vinculados a uma importacao (via itens_importacao.lancamento_id).
 * Regra de auditoria do PADRAO/AGENTS: NAO apagar lancamento conciliado.
 * - Bloqueia a exclusao inteira se ALGUM dos lancamentos estiver conciliado.
 * - Tambem exclui as baixas vinculadas (cascade via baixas.lancamento_id).
 * Retorna { ok, excluidos, bloqueadoPor }.
 */
export function excluirLancamentosImportacao(db, importacaoId) {
  if (!Number.isInteger(importacaoId)) throw new Error('importacaoId obrigatorio.');
  // Confere que a importacao existe
  const imp = db.exec('SELECT id FROM importacoes WHERE id = ?', [importacaoId])[0]?.values?.[0];
  if (!imp) throw new Error('Importacao nao encontrada.');
  // Busca os lancamentos vinculados via itens_importacao
  const vincs = db.exec(
    'SELECT DISTINCT l.id, l.status FROM itens_importacao ii JOIN lancamentos l ON l.id = ii.lancamento_id WHERE ii.importacao_id = ? AND ii.lancamento_id IS NOT NULL',
    [importacaoId]
  )[0]?.values ?? [];
  if (!vincs.length) {
    return { ok: true, excluidos: 0, bloqueadoPor: null, mensagem: 'Nenhum lancamento vinculado a esta importacao.' };
  }
  // Bloqueia se algum estiver conciliado
  const conciliados = vincs.filter((v) => v[1] === 'conciliado');
  if (conciliados.length > 0) {
    return {
      ok: false,
      excluidos: 0,
      bloqueadoPor: 'conciliado',
      mensagem: `${conciliados.length} lancamento(s) ja estao conciliados. Cancele/estorne via Conciliacao antes de excluir.`,
      conciliados: conciliados.map((v) => v[0]),
    };
  }
  // Exclui baixas vinculadas (cascade) + lancamentos
  db.run('BEGIN');
  try {
    // 1. Limpa a referencia nos itens_importacao ANTES (FK sem CASCADE)
    db.run('UPDATE itens_importacao SET lancamento_id = NULL, status = ? WHERE importacao_id = ?', ['ignorado', importacaoId]);
    // 2. Exclui baixas vinculadas + lancamentos
    for (const [id] of vincs) {
      db.run('DELETE FROM baixas WHERE lancamento_id = ?', [id]);
      db.run('DELETE FROM lancamentos WHERE id = ?', [id]);
    }
    // 3. Marca a importacao como cancelada
    db.run("UPDATE importacoes SET status = 'cancelada' WHERE id = ?", [importacaoId]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, excluidos: vincs.length, bloqueadoPor: null, mensagem: `${vincs.length} lancamento(s) excluido(s). Importacao marcada como cancelada.` };
}
