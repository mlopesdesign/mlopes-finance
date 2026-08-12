import { criarApi } from './backend/servidor.js';
import { migrar } from './backend/migracoes.js';
import { APP_VERSION as AMBIENTE_VERSION, abrirBancoLocal } from './backend/ambiente.js';
import { aplicarTemaDoBanco, DEFAULTS as TEMA_DEFAULTS } from './tema.js';
import { renderConfiguracoes } from './telas/configuracoes.js';
import { renderCadastroGenerico } from './telas/cadastros-generico.js';

const APP_VERSION = '0.5.2';
const FALLBACK_VERSION = AMBIENTE_VERSION;
let api; let contextoId; let contas = []; let categorias = [];
const $ = (s) => document.querySelector(s); const app = $('#app');
const statusEl = () => document.getElementById('status');
const setStatus = (msg) => { const s = statusEl(); if (s) s.textContent = msg; if (typeof document !== 'undefined') document.title = 'MLopes Finance — ' + msg; };

// Log file persistente: captura tudo o que acontece no boot
const _logBuf = [];
function log(...a) {
  const stamp = new Date().toISOString().slice(11, 23);
  const msg = `[${stamp}] ` + a.map((x) => { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch { return String(x); } }).join(' ');
  _logBuf.push(msg);
  try { console.log('[boot]', ...a); } catch { /* noop */ }
  // Persiste o log a cada 5 entradas via Neutralino (se disponivel) ou LocalStorage
  if (_logBuf.length % 5 === 0) flushLog();
}
function flushLog() {
  const payload = _logBuf.join('\n') + '\n';
  try { localStorage.setItem('mlopes-boot-log', payload); } catch { /* noop */ }
  if (globalThis.Neutralino?.filesystem) {
    try {
      const path = `${globalThis.NL_APPDATA || (globalThis.NL_PATH || '')}/mlopes-boot.log`;
      const enc = new TextEncoder();
      globalThis.Neutralino.filesystem.writeBinaryFile(path, enc.encode(payload)).catch(() => {});
    } catch { /* noop */ }
  }
}

// Captura erros globais nao tratados (import errors, etc)
window.addEventListener('error', (ev) => {
  log('window.error:', ev.message, ev.filename, ev.lineno + ':' + ev.colno);
  if (ev.error && ev.error.stack) log('  stack:', ev.error.stack);
  flushLog();
  if (app) app.innerHTML = `<div class="error"><strong>Erro de carregamento</strong><br>${(ev.message || '').replaceAll('<', '&lt;')}<br><small>${(ev.filename || '').replaceAll('<', '&lt;')}:${ev.lineno}</small></div>`;
});
window.addEventListener('unhandledrejection', (ev) => {
  log('unhandledrejection:', ev.reason?.message || ev.reason);
  if (ev.reason?.stack) log('  stack:', ev.reason.stack);
  flushLog();
});

const money = (c) => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const rows = (data) => data.map((r) => `<tr>${r.map((v) => `<td>${String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</td>`).join('')}</tr>`).join('');

log('app.js modulo carregado, Neutralino=', !!globalThis.Neutralino, 'NL_PORT=', globalThis.NL_PORT);

// Helper: timeout em promise (rejeita se demorar demais)
function comTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout em ${label} (${ms}ms)`)), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function boot() {
  setStatus('Inicializando runtime nativo...');
  log('boot start');
  if (!globalThis.Neutralino) {
    const msg = 'Neutralino nao disponivel. Abra pelo atalho instalado, nao pelo navegador.';
    log('FATAL:', msg);
    if (app) app.innerHTML = `<div class="error">${msg}</div>`;
    setStatus('Falha: ' + msg);
    return;
  }
  // Inicializa runtime nativo
  try { Neutralino.init(); } catch (e) { log('Neutralino.init threw:', e); }
  await new Promise((r) => setTimeout(r, 300));
  log('Neutralino initialized, port=', globalThis.NL_PORT);

  setStatus('Carregando biblioteca do banco...');
  if (typeof globalThis.initSqlJs !== 'function') {
    const msg = 'initSqlJs nao foi carregado. Verifique js/vendor/sql-wasm.js.';
    log('FATAL:', msg);
    if (app) app.innerHTML = `<div class="error">${msg}</div>`;
    setStatus('Falha: ' + msg);
    return;
  }
  const SQL = await comTimeout(globalThis.initSqlJs({ locateFile: (f) => `js/vendor/${f}` }), 15000, 'initSqlJs');
  log('initSqlJs loaded');

  setStatus('Lendo schema...');
  const schemaResp = await comTimeout(fetch('js/backend/schema.sql'), 10000, 'fetch schema');
  if (!schemaResp.ok) throw new Error('schema.sql HTTP ' + schemaResp.status);
  const schema = await schemaResp.text();
  log('schema loaded,', schema.length, 'chars');

  setStatus('Abrindo banco local...');
  const local = await comTimeout(abrirBancoLocal(SQL, schema), 15000, 'abrirBancoLocal');
  log('banco aberto em', local.arquivo);

  setStatus('Verificando migracoes...');
  const versaoAntes = Number(local.db.exec("SELECT valor FROM meta WHERE chave = 'schema_version'")[0]?.values?.[0]?.[0] ?? '0');
  migrar(local.db);
  const versaoDepois = Number(local.db.exec("SELECT valor FROM meta WHERE chave = 'schema_version'")[0]?.values?.[0]?.[0] ?? '0');
  if (versaoDepois > versaoAntes) await local.persistir();
  log('migracao: v' + versaoAntes + ' -> v' + versaoDepois);

  setStatus('Aplicando tema...');
  aplicarTemaDoBanco(local.db);
  api = criarApi(local.db, () => local.persistir());
  const contexts = api('contextos:listar');
  if (!contexts.length) { contextoId = api('contextos:criar', { nome: 'Meu contexto', descricao: 'Contexto criado nesta instalação' }); await local.persistir(); } else contextoId = contexts[0][0];
  log('contextoId=', contextoId);

  setStatus('Pronto');
  renderHeader(local.arquivo);
  document.querySelectorAll('.nav-button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.nav-button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    render(b.dataset.view);
  }));
  render('dashboard');
  log('boot done');
}

function renderHeader(dbPath) {
  const cfg = api('configuracoes:listar');
  const nome = cfg.nome_exibicao?.valor || 'MLopes Finance';
  const tema = cfg.tema?.valor || TEMA_DEFAULTS.tema;
  const status = document.getElementById('status');
  const actions = document.getElementById('topbar-actions');
  if (status) status.textContent = `Versão ${APP_VERSION} · ${dbPath}`;
  if (actions) {
    actions.innerHTML = `<button class="pill" id="toggle-tema" title="Alternar tema"><span class="dot"></span>${tema === 'dark' ? '☾ Escuro' : '☀ Claro'}</button><span class="pill is-static" title="Versão do aplicativo">VERSÃO ${APP_VERSION}</span>`;
    document.getElementById('toggle-tema').onclick = () => {
      const novo = api('configuracoes:obter', { chave: 'tema' }).valor === 'dark' ? 'light' : 'dark';
      api('configuracoes:salvar', { chave: 'tema', valor: novo, tipo: 'texto' });
      location.reload();
    };
  }
  const strong = document.querySelector('.topbar strong');
  if (strong) strong.textContent = nome;
}

function render(view) {
  if (view === 'dashboard') return renderDashboard();
  if (view === 'lancamentos') return renderLancamentos();
  if (view === 'contas') return renderContas();
  if (view === 'categorias') return renderCategorias();
  if (view === 'clientes') return renderCadastroGenerico('clientes', contextoId, api);
  if (view === 'fornecedores') return renderCadastroGenerico('fornecedores', contextoId, api);
  if (view === 'projetos') return renderCadastroGenerico('projetos', contextoId, api);
  if (view === 'centros_custo') return renderCadastroGenerico('centros_custo', contextoId, api);
  if (view === 'tags') return renderCadastroGenerico('tags', contextoId, api);
  if (view === 'transferencias') return renderTransferencias();
  if (view === 'baixas') return renderBaixas();
  if (view === 'configuracoes') return renderConfiguracoes(contextoId, api);
  return renderDashboard();
}

function renderDashboard() {
  const s = api('dashboard:resumo', { contextoId });
  const totClientes = api('clientes:listar', { contextoId }).length;
  const totProjetos = api('projetos:listar', { contextoId }).length;
  const totCC = api('centros_custo:listar', { contextoId }).length;
  const totTags = api('tags:listar', { contextoId }).length;
  app.innerHTML = `<span class="eyebrow">VISÃO GERAL</span><h1>Seu dinheiro, no seu <em>ritmo</em>.</h1><p class="subtitle">Acompanhe o movimento do contexto financeiro selecionado.</p><div class="cards"><div class="card"><span class="card-label">Receitas</span><span class="card-value positive">${money(s.receitas)}</span><span class="card-sub">no período</span></div><div class="card"><span class="card-label">Despesas</span><span class="card-value negative">${money(s.despesas)}</span><span class="card-sub">no período</span></div><div class="card"><span class="card-label">Saldo</span><span class="card-value">${money(s.saldo)}</span><span class="card-sub">resultado</span></div><div class="card"><span class="card-label">Contas</span><span class="card-value">${api('contas:listar', { contextoId }).length}</span><span class="card-sub">cadastradas</span></div></div><div class="cards"><div class="card"><span class="card-label">Clientes</span><span class="card-value">${totClientes}</span><span class="card-sub">cadastrados</span></div><div class="card"><span class="card-label">Projetos</span><span class="card-value">${totProjetos}</span><span class="card-sub">vinculáveis</span></div><div class="card"><span class="card-label">Centros de custo</span><span class="card-value">${totCC}</span><span class="card-sub">apoiados</span></div><div class="card"><span class="card-label">Tags</span><span class="card-value">${totTags}</span><span class="card-sub">livres</span></div></div><div class="panel"><h2>Próximo passo</h2><p style="color: var(--muted); margin: 0;">Cadastre uma conta e registre seu primeiro lançamento. Os dados ficam no banco local desta instalação.</p></div>`;
}

function renderContas() {
  contas = api('contas:listar', { contextoId });
  app.innerHTML = `<div class="toolbar"><div><h1>Contas</h1><p class="subtitle">Contas bancárias, cartões e investimentos.</p></div><button class="button" id="new">Nova conta</button></div><div class="panel"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Saldo inicial</th></tr></thead><tbody>${rows(contas)}</tbody></table>${!contas.length ? '<div class="empty"><div class="icon">◌</div>Nenhuma conta cadastrada.</div>' : ''}</div>`;
  $('#new').onclick = formConta;
}

function formConta() {
  app.innerHTML = `<div class="panel"><h1>Nova conta</h1><form id="form"><div class="form-grid"><label>Nome<input name="nome" required></label><label>Tipo<select name="tipo"><option value="bancaria">Conta bancária</option><option value="cartao">Cartão de crédito</option><option value="investimento">Investimento</option></select></label><label>Saldo inicial (R$)<input name="saldo" inputmode="decimal" value="0"></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Salvar</button></div></form></div>`;
  $('#cancel').onclick = renderContas;
  $('#form').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); api('contas:criar', { contextoId, nome: f.get('nome'), tipo: f.get('tipo'), saldoInicialCentavos: Math.round(Number(String(f.get('saldo')).replace(',', '.')) * 100) }); renderContas(); };
}

function renderCategorias() {
  categorias = api('categorias:listar', { contextoId });
  app.innerHTML = `<div class="toolbar"><div><h1>Categorias</h1><p class="subtitle">Classificação editável para este contexto.</p></div><button class="button" id="new">Nova categoria</button></div><div class="panel"><table><thead><tr><th>Nome</th><th>Natureza</th></tr></thead><tbody>${rows(categorias)}</tbody></table>${!categorias.length ? '<div class="empty"><div class="icon">◌</div>Nenhuma categoria cadastrada.</div>' : ''}</div>`;
  $('#new').onclick = formCategoria;
}

function formCategoria() {
  app.innerHTML = `<div class="panel"><h1>Nova categoria</h1><form id="form"><div class="form-grid"><label>Nome<input name="nome" required></label><label>Natureza<select name="natureza"><option value="ambas">Receitas e despesas</option><option value="receita">Receita</option><option value="despesa">Despesa</option></select></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Salvar</button></div></form></div>`;
  $('#cancel').onclick = renderCategorias;
  $('#form').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); api('categorias:criar', { contextoId, nome: f.get('nome'), natureza: f.get('natureza') }); renderCategorias(); };
}

function renderLancamentos() {
  contas = api('contas:listar', { contextoId });
  categorias = api('categorias:listar', { contextoId });
  const clientes = api('clientes:listar', { contextoId });
  const projetos = api('projetos:listar', { contextoId });
  const centrosCusto = api('centros_custo:listar', { contextoId });
  const data = api('lancamentos:listar', { contextoId });
  app.innerHTML = `<div class="toolbar"><div><h1>Lançamentos</h1><p class="subtitle">Receitas, despesas e transferências com rastreabilidade.</p></div><div style="display:flex;gap:8px"><button class="button secondary" id="transf">Transferir entre contas</button><button class="button" id="new">Novo lançamento</button></div></div><div class="panel"><table><thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Categoria</th><th>Cliente</th><th>Natureza</th><th>Valor</th><th>Status</th><th>Saldo</th></tr></thead><tbody>${data.map((r) => { const lId = r[0]; const saldo = api('baixas:saldo', { lancamentoId: lId }); return `<tr><td>${r[11] || ''}</td><td>${r[13] || ''}</td><td>${r[19] || ''}</td><td>${r[21] || ''}</td><td>${r[23] || ''}</td><td>${tdNatureza(r[10])}</td><td class="${r[10] === 'receita' ? 'positive' : 'negative'}">${money(r[12])}</td><td>${r[16] || 'aberto'}</td><td><button class="button ghost" data-baixa="${lId}">${money(saldo)}</button></td></tr>`; }).join('')}</tbody></table>${!data.length ? '<div class="empty"><div class="icon">◌</div>Nenhum lançamento cadastrado.</div>' : ''}</div>`;
  $('#new').onclick = () => formLancamento(clientes, projetos, centrosCusto);
  $('#transf').onclick = formTransferencia;
  document.querySelectorAll('button[data-baixa]').forEach(btn => btn.onclick = () => {
    const lId = Number(btn.dataset.baixa);
    formBaixa(lId);
  });
}
function tdNatureza(n) { return n === 'receita' ? 'Receita' : n === 'despesa' ? 'Despesa' : 'Transferência'; }

function formLancamento(clientes, projetos, centrosCusto) {
  if (!contas.length) { app.innerHTML = '<div class="error">Cadastre uma conta antes de registrar lançamentos.</div>'; return; }
  app.innerHTML = `<div class="panel"><h1>Novo lançamento</h1><form id="form"><div class="form-grid"><label>Descrição<input name="descricao" required></label><label>Natureza<select name="natureza"><option value="despesa">Despesa</option><option value="receita">Receita</option></select></label><label>Valor (R$)<input name="valor" inputmode="decimal" required></label><label>Data<input type="date" name="data" required value="${new Date().toISOString().slice(0,10)}"></label><label>Conta<select name="conta">${contas.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Categoria<select name="categoria"><option value="">Sem categoria</option>${categorias.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Cliente<select name="cliente"><option value="">Sem cliente</option>${clientes.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Projeto<select name="projeto"><option value="">Sem projeto</option>${projetos.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Centro de custo<select name="centro_custo"><option value="">Sem centro</option>${centrosCusto.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Salvar</button></div></form></div>`;
  $('#cancel').onclick = renderLancamentos;
  $('#form').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); api('lancamentos:criar', { contextoId, contaId: Number(f.get('conta')), categoriaId: f.get('categoria') ? Number(f.get('categoria')) : null, clienteId: f.get('cliente') ? Number(f.get('cliente')) : null, projetoId: f.get('projeto') ? Number(f.get('projeto')) : null, centroCustoId: f.get('centro_custo') ? Number(f.get('centro_custo')) : null, natureza: f.get('natureza'), valorCentavos: Math.round(Number(String(f.get('valor')).replace(',', '.')) * 100), dataCompetencia: f.get('data'), descricao: f.get('descricao') }); renderLancamentos(); };
}

function formTransferencia() {
  if (contas.length < 2) { app.innerHTML = '<div class="error">Cadastre pelo menos 2 contas para transferir.</div>'; return; }
  app.innerHTML = `<div class="panel"><h1>Transferência entre contas</h1><form id="form"><div class="form-grid"><label>Conta origem<select name="origem">${contas.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Conta destino<select name="destino">${contas.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Valor (R$)<input name="valor" inputmode="decimal" required></label><label>Data<input type="date" name="data" required value="${new Date().toISOString().slice(0,10)}"></label><label>Descrição<input name="descricao" value="Transferência"></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Transferir</button></div></form></div>`;
  $('#cancel').onclick = renderLancamentos;
  $('#form').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); try { api('transferencias:criar', { contextoId, contaOrigemId: Number(f.get('origem')), contaDestinoId: Number(f.get('destino')), valorCentavos: Math.round(Number(String(f.get('valor')).replace(',', '.')) * 100), dataCompetencia: f.get('data'), descricao: f.get('descricao') || 'Transferência' }); renderLancamentos(); } catch (err) { alert('Erro: ' + err.message); } };
}

function formBaixa(lancamentoId) {
  const saldo = api('baixas:saldo', { lancamentoId });
  const baixas = api('baixas:listar', { lancamentoId });
  app.innerHTML = `<div class="panel"><h1>Baixas do lançamento #${lancamentoId}</h1><p class="subtitle">Saldo em aberto: <strong>${money(saldo)}</strong></p><form id="form-nova"><div class="form-grid"><label>Valor (R$)<input name="valor" inputmode="decimal" required value="${(saldo/100).toFixed(2)}"></label><label>Data<input type="date" name="data" required value="${new Date().toISOString().slice(0,10)}"></label><label>Forma<input name="forma" value="pix"></label><label>Observações<input name="obs"></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Registrar baixa</button></div></form><table style="margin-top:16px"><thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Obs</th></tr></thead><tbody>${baixas.map((b) => `<tr><td>${b[3]}</td><td>${money(b[2])}</td><td>${b[4]}</td><td>${b[5] || ''}</td></tr>`).join('')}</tbody></table></div>`;
  $('#cancel').onclick = renderLancamentos;
  $('#form-nova').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); try { api('baixas:registrar', { lancamentoId, valorCentavos: Math.round(Number(String(f.get('valor')).replace(',', '.')) * 100), dataBaixa: f.get('data'), formaPagamento: f.get('forma') || 'pix', observacoes: f.get('obs') || '' }); renderLancamentos(); } catch (err) { alert('Erro: ' + err.message); } };
}

function renderTransferencias() {
  const transfs = api('transferencias:listar', { contextoId });
  app.innerHTML = `<span class="eyebrow">CADASTROS</span><h1>Transferências</h1><p class="subtitle">Débitos e créditos vinculados entre contas do mesmo contexto.</p><div class="panel"><table><thead><tr><th>Data</th><th>Conta origem</th><th>Conta destino</th><th>Valor</th></tr></thead><tbody>${transfs.map((t) => `<tr><td>${t[5]}</td><td>${t[6] || ''}</td><td>${t[7] || ''}</td><td>${money(t[4])}</td></tr>`).join('')}</tbody></table>${!transfs.length ? '<div class="empty"><div class="icon">◌</div>Nenhuma transferência. Cadastre via tela de Lançamentos.</div>' : ''}</div>`;
}

function renderBaixas() {
  const data = api('lancamentos:listar', { contextoId }).filter((l) => l[16] !== 'estornado' && (l[8] === 'despesa' || l[8] === 'receita'));
  app.innerHTML = `<span class="eyebrow">FINANCEIRO</span><h1>Baixas e saldos em aberto</h1><p class="subtitle">Pagamentos parciais e totais. Não excede o valor original.</p><div class="panel"><table><thead><tr><th>Lançamento</th><th>Vencimento</th><th>Valor original</th><th>Saldo em aberto</th><th>Status</th><th>Ação</th></tr></thead><tbody>${data.map((l) => { const id = l[0]; const saldo = api('baixas:saldo', { lancamentoId: id }); return `<tr><td>${l[7]}</td><td>${l[9] || l[11] || ''}</td><td>${money(l[6])}</td><td>${money(saldo)}</td><td>${l[15] || 'aberto'}</td><td><button class="button ghost" data-baixa="${id}">Lançar baixa</button></td></tr>`; }).join('')}</tbody></table></div>`;
  document.querySelectorAll('button[data-baixa]').forEach(btn => btn.onclick = () => formBaixa(Number(btn.dataset.baixa)));
}

boot().catch((e) => {
  log('BOOT ERRO:', e?.message || e);
  if (e?.stack) log('  stack:', e.stack);
  flushLog();
  console.error('[boot] ERRO:', e);
  setStatus('Falha: ' + (e?.message || e));
  if (app) app.innerHTML = `<div class="error"><strong>Falha ao iniciar</strong><br>${String(e?.message || e).replaceAll('<', '&lt;')}<br><small>Log salvo em mlopes-boot.log (mesma pasta do banco).</small></div>`;
});
