import { criarApi } from './backend/servidor.js';
import { migrar } from './backend/migracoes.js';
import { APP_VERSION as AMBIENTE_VERSION, abrirBancoLocal } from './backend/ambiente.js';
import { aplicarTemaDoBanco, DEFAULTS as TEMA_DEFAULTS } from './tema.js';
import { renderConfiguracoes } from './telas/configuracoes.js';
import { renderCadastroGenerico } from './telas/cadastros-generico.js';
import { renderImportacao } from './telas/importacao.js';
import { renderRelatorios } from './telas/relatorios.js';
import { renderContextos } from './telas/contextos.js';
import * as updUI from './update.js';

const APP_VERSION = '0.8.16';
const FALLBACK_VERSION = AMBIENTE_VERSION;
let api; let contextoId; let contas = []; let categorias = []; let appDbPath = '';
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

// Toast global (canto inferior direito, some sozinho).
// Uso: toast('Salvo com sucesso!', 'ok'); toast('Erro ao salvar', 'err'); toast('Info'); toast('Atenção', 'warn')
// Tambem disponivel em globalThis.toast() pra outros modulos.
function toast(msg, tipo = 'ok', duracaoMs = 3500) {
  let box = document.getElementById('toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-box';
    box.className = 'toast-box';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  // Botao fechar
  const btn = document.createElement('button');
  btn.className = 'toast-close';
  btn.type = 'button';
  btn.textContent = '×';
  btn.onclick = () => { t.classList.add('is-hiding'); setTimeout(() => t.remove(), 200); };
  t.appendChild(btn);
  box.appendChild(t);
  // Auto-fade
  setTimeout(() => {
    if (t.isConnected) { t.classList.add('is-hiding'); setTimeout(() => t.remove(), 200); }
  }, duracaoMs);
}
globalThis.toast = toast;
globalThis.toastOk = (m, d) => toast(m, 'ok', d);
globalThis.toastErr = (m, d) => toast(m, 'err', d);
globalThis.toastWarn = (m, d) => toast(m, 'warn', d);
globalThis.toastInfo = (m, d) => toast(m, 'info', d);

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
  appDbPath = local.arquivo;
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
  renderHeader();
  document.querySelectorAll('.nav-button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.nav-button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    render(b.dataset.view);
  }));
  render('dashboard');
  log('boot done');

  // Auto-update via GitHub Releases: checa em background, atualiza pill/banner/modal
  globalThis._appApi = api;
  globalThis._appVersion = APP_VERSION;
  updUI.renderPill();
  updUI.checar(api, { versaoAtual: APP_VERSION })
    .then((r) => log('update check:', r?.temAtualizacao ? `${r.tagName} disponivel` : (r?.erro ? `erro: ${r.erro}` : 'sem atualizacao')))
    .catch((e) => log('update erro:', e.message));
}

function renderHeader() {
  const cfg = api('configuracoes:listar');
  const nome = cfg.nome_exibicao?.valor || 'MLopes Finance';
  const tema = cfg.tema?.valor || TEMA_DEFAULTS.tema;
  const actions = document.getElementById('topbar-actions');
  if (actions) {
    actions.innerHTML = `<button class="pill" id="toggle-tema" title="Alternar tema"><span class="dot"></span>${tema === 'dark' ? '☾ Escuro' : '☀ Claro'}</button><span class="pill is-static" title="Versão do aplicativo">VERSÃO ${APP_VERSION}</span>`;
    document.getElementById('toggle-tema').onclick = () => {
      const novo = api('configuracoes:obter', { chave: 'tema' }).valor === 'dark' ? 'light' : 'dark';
      api('configuracoes:salvar', { chave: 'tema', valor: novo, tipo: 'texto' });
      // Aplica no DOM direto (sem reload) e re-renderiza o header pra atualizar o icone
      document.documentElement.setAttribute('data-theme', novo);
      renderHeader();
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
  if (view === 'relatorios') return renderRelatorios(contextoId, api);
  if (view === 'importacao') return renderImportacao(contextoId, api);
  if (view === 'contextos') return renderContextos(contextoId, api, (novoId) => trocarContextoAtivo(novoId, api));
  if (view === 'configuracoes') return renderConfiguracoes(contextoId, api, appDbPath);
  return renderDashboard();
}


// Renderiza o seletor de contexto ativo no header (pill "Contexto: [▼]")
function renderHeaderPillContexto() {
  const actions = document.getElementById('topbar-actions');
  if (!actions || !api) return;
  // Remove pill antiga
  const old = document.getElementById('contexto-pill');
  if (old) old.remove();
  const contextos = api('contextos:listar', {});
  if (!contextos.length) return;
  const atual = contextos.find(c => c[0] === contextoId);
  const nomeAtual = atual ? atual[1] : '—';
  const pill = document.createElement('select');
  pill.id = 'contexto-pill';
  pill.className = 'pill contexto-select';
  pill.title = 'Trocar de contexto financeiro';
  for (const c of contextos) {
    const opt = document.createElement('option');
    opt.value = c[0];
    opt.textContent = c[1];
    if (c[0] === contextoId) opt.selected = true;
    pill.appendChild(opt);
  }
  pill.onchange = (e) => trocarContextoAtivo(Number(e.target.value), api);
  // Adiciona no inicio (antes dos outros pills)
  const label = document.createElement('span');
  label.className = 'pill is-static contexto-label';
  label.textContent = 'Contexto:';
  actions.insertBefore(label, actions.firstChild);
  actions.insertBefore(pill, actions.firstChild);
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
  const linhas = contas.length ? contas.map((r) => {
    const nome = String(r[2] || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
    return `<tr><td>${nome}</td><td>${r[3] || ''}</td><td>${money(r[4] || 0)}</td><td><button class="button ghost" data-edit="${r[0]}">Editar</button> <button class="button danger" data-excluir="${r[0]}" data-nome="${nome}">Excluir</button></td></tr>`;
  }).join('') : '';
  app.innerHTML = `<div class="toolbar"><div><h1>Contas</h1><p class="subtitle">Contas bancárias, cartões e investimentos.</p></div><button class="button" id="new">Nova conta</button></div><div class="panel"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Saldo inicial</th><th></th></tr></thead><tbody>${linhas}</tbody></table>${!contas.length ? '<div class="empty"><div class="icon">◌</div>Nenhuma conta cadastrada.</div>' : ''}</div>`;
  $('#new').onclick = () => formConta();
  document.querySelectorAll('button[data-edit]').forEach(btn => btn.onclick = () => {
    const id = Number(btn.dataset.edit);
    const conta = contas.find(c => c[0] === id);
    formConta(conta);
  });
  document.querySelectorAll('button[data-excluir]').forEach(btn => btn.onclick = () => {
    const id = Number(btn.dataset.excluir);
    const nome = btn.dataset.nome;
    if (!confirm(`Excluir a conta "${nome}"?\n\nSe houver lançamentos vinculados, será necessário confirmar o cascade (apaga também os lançamentos e baixas).`)) return;
    try {
      api('contas:excluir', { id });
      if (globalThis.toastOk) toastOk(`Conta "${nome}" excluída.`);
      renderContas();
    } catch (e) {
      if (confirm(`${e.message}\n\nApagar TUDO em cascata (lançamentos e baixas vinculados)? Esta ação é IRREVERSÍVEL.`)) {
        try {
          api('contas:excluir', { id, cascade: true });
          if (globalThis.toastOk) toastOk(`Conta "${nome}" e dados vinculados excluídos.`);
          renderContas();
        } catch (e2) { if (globalThis.toastErr) toastErr('Erro: ' + e2.message); }
      }
    }
  });
}

function formConta(item) {
  const titulo = item ? 'Editar conta' : 'Nova conta';
  const nome = item ? (item[2] || '') : '';
  const tipo = item ? (item[3] || 'bancaria') : 'bancaria';
  const saldo = item ? (Number(item[4] || 0) / 100).toFixed(2).replace('.', ',') : '0';
  app.innerHTML = `<div class="panel"><h1>${titulo}</h1><form id="form"><div class="form-grid"><label>Nome<input name="nome" required value="${nome}"></label><label>Tipo<select name="tipo"><option value="bancaria" ${tipo === 'bancaria' ? 'selected' : ''}>Conta bancária</option><option value="cartao" ${tipo === 'cartao' ? 'selected' : ''}>Cartão de crédito</option><option value="investimento" ${tipo === 'investimento' ? 'selected' : ''}>Investimento</option></select></label><label>Saldo inicial (R$)<input name="saldo" inputmode="decimal" value="${saldo}"></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Salvar</button></div></form></div>`;
  $('#cancel').onclick = renderContas;
  $('#form').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const dados = { contextoId, nome: f.get('nome'), tipo: f.get('tipo'), saldoInicialCentavos: Math.round(Number(String(f.get('saldo')).replace(',', '.')) * 100) };
    try {
      if (item) { api('contas:atualizar', { id: item[0], ...dados }); }
      else { api('contas:criar', dados); }
      if (globalThis.toastOk) toastOk(item ? 'Conta atualizada.' : 'Conta criada.');
      renderContas();
    } catch (err) { if (globalThis.toastErr) toastErr('Erro: ' + err.message); }
  };
}

function renderCategorias() {
  categorias = api('categorias:listar', { contextoId });
  const linhas = categorias.length ? categorias.map((r) => {
    const nome = String(r[2] || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
    return `<tr><td>${nome}</td><td>${r[3] || ''}</td><td><button class="button ghost" data-edit="${r[0]}">Editar</button> <button class="button danger" data-excluir="${r[0]}" data-nome="${nome}">Excluir</button></td></tr>`;
  }).join('') : '';
  app.innerHTML = `<div class="toolbar"><div><h1>Categorias</h1><p class="subtitle">Classificação editável para este contexto.</p></div><button class="button" id="new">Nova categoria</button></div><div class="panel"><table><thead><tr><th>Nome</th><th>Natureza</th><th></th></tr></thead><tbody>${linhas}</tbody></table>${!categorias.length ? '<div class="empty"><div class="icon">◌</div>Nenhuma categoria cadastrada.</div>' : ''}</div>`;
  $('#new').onclick = () => formCategoria();
  document.querySelectorAll('button[data-edit]').forEach(btn => btn.onclick = () => {
    const id = Number(btn.dataset.edit);
    const cat = categorias.find(c => c[0] === id);
    formCategoria(cat);
  });
  document.querySelectorAll('button[data-excluir]').forEach(btn => btn.onclick = () => {
    const id = Number(btn.dataset.excluir);
    const nome = btn.dataset.nome;
    if (!confirm(`Excluir a categoria "${nome}"?\n\nSe houver lançamentos vinculados, será necessário confirmar o cascade (apaga também os lançamentos).`)) return;
    try {
      api('categorias:excluir', { id });
      if (globalThis.toastOk) toastOk(`Categoria "${nome}" excluída.`);
      renderCategorias();
    } catch (e) {
      if (confirm(`${e.message}\n\nApagar TUDO em cascata (lançamentos vinculados)? Esta ação é IRREVERSÍVEL.`)) {
        try {
          api('categorias:excluir', { id, cascade: true });
          if (globalThis.toastOk) toastOk(`Categoria "${nome}" e lançamentos vinculados foram excluídos.`);
          renderCategorias();
        } catch (e2) { if (globalThis.toastErr) toastErr('Erro: ' + e2.message); }
      }
    }
  });
}

function formCategoria(item) {
  const titulo = item ? 'Editar categoria' : 'Nova categoria';
  const nome = item ? (item[2] || '') : '';
  const natureza = item ? (item[3] || 'ambas') : 'ambas';
  app.innerHTML = `<div class="panel"><h1>${titulo}</h1><form id="form"><div class="form-grid"><label>Nome<input name="nome" required value="${nome}"></label><label>Natureza<select name="natureza"><option value="ambas" ${natureza === 'ambas' ? 'selected' : ''}>Receitas e despesas</option><option value="receita" ${natureza === 'receita' ? 'selected' : ''}>Receita</option><option value="despesa" ${natureza === 'despesa' ? 'selected' : ''}>Despesa</option></select></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Salvar</button></div></form></div>`;
  $('#cancel').onclick = renderCategorias;
  $('#form').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const dados = { contextoId, nome: f.get('nome'), natureza: f.get('natureza') };
    try {
      if (item) { api('categorias:atualizar', { id: item[0], ...dados }); }
      else { api('categorias:criar', dados); }
      if (globalThis.toastOk) toastOk(item ? 'Categoria atualizada.' : 'Categoria criada.');
      renderCategorias();
    } catch (err) { if (globalThis.toastErr) toastErr('Erro: ' + err.message); }
  };
}

function renderLancamentos() {
  contas = api('contas:listar', { contextoId });
  categorias = api('categorias:listar', { contextoId });
  const clientes = api('clientes:listar', { contextoId });
  const projetos = api('projetos:listar', { contextoId });
  const centrosCusto = api('centros_custo:listar', { contextoId });
  const data = api('lancamentos:listar', { contextoId });
  // Schema detalhado: 0=id 1=contexto 2=conta 3=categoria 4=cliente 5=projeto 6=cc
  //   7=natureza 8=valor 9=data_comp 10=data_venc 11=desc 12=obs
  //   13=transf_id 14=status 15=criado 16=atualizado
  //   17=conta_nome 18=categoria_nome 19=cliente_nome 20=projeto_nome 21=cc_nome
  const linhas = data.map((r) => {
    const lId = r[0];
    const status = r[14] || 'aberto';
    const natureza = r[7];
    const valor = r[8];
    const dataComp = r[9] || '';
    const descricao = String(r[11] || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
    const contaNome = r[17] || '—';
    const catNome = r[18] || '';
    const cliNome = r[19] || '';
    const projNome = r[20] || '';
    let acoes = `<button class="button ghost" data-baixa="${lId}" title="Lançar pagamento parcial">${money(api('baixas:saldo', { lancamentoId: lId }))}</button>`;
    acoes += ` <button class="button ghost" data-editar="${lId}" title="Editar lançamento">Editar</button>`;
    if (status === 'conciliado') {
      acoes += ` <button class="button ghost" data-estornar="${lId}" title="Estornar (cria lançamento inverso)">Estornar</button>`;
    } else if (status === 'aberto') {
      acoes += ` <button class="button ghost" data-conciliar="${lId}" title="Marcar como pago">Conciliar</button>`;
      acoes += ` <button class="button danger" data-excluir="${lId}" title="Excluir lançamento">Excluir</button>`;
    }
    const statusPill = status === 'conciliado' ? '<span class="pill is-static" style="color:var(--positive)">Conciliado</span>' : '<span class="pill warn">Aberto</span>';
    return `<tr>
      <td>${dataComp}</td>
      <td><strong>${descricao}</strong></td>
      <td>${contaNome}</td>
      <td>${catNome}</td>
      <td>${cliNome}${projNome ? ` <span style="color:var(--muted);font-size:11px">/ ${projNome}</span>` : ''}</td>
      <td>${tdNatureza(natureza)}</td>
      <td class="${natureza === 'receita' ? 'positive' : 'negative'}">${money(valor)}</td>
      <td>${statusPill}</td>
      <td>${acoes}</td>
    </tr>`;
  }).join('');
  app.innerHTML = `<div class="toolbar"><div><h1>Lançamentos</h1><p class="subtitle">Receitas e despesas com rastreabilidade. Conciliados não podem ser editados nem excluídos — use estornar (cria lançamento inverso).</p></div><div style="display:flex;gap:8px"><button class="button secondary" id="transf">Transferir entre contas</button><button class="button" id="new">Novo lançamento</button></div></div><div class="panel"><table><thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Categoria</th><th>Cliente / Projeto</th><th>Natureza</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>${linhas}</tbody></table>${!data.length ? '<div class="empty"><div class="icon">◌</div>Nenhum lançamento cadastrado.</div>' : ''}</div>`;
  $('#new').onclick = () => formLancamento(clientes, projetos, centrosCusto);
  $('#transf').onclick = formTransferencia;
  // Handlers
  document.querySelectorAll('button[data-baixa]').forEach(btn => btn.onclick = () => formBaixa(Number(btn.dataset.baixa)));
  document.querySelectorAll('button[data-editar]').forEach(btn => btn.onclick = () => formEditarLancamento(Number(btn.dataset.editar), clientes, projetos, centrosCusto));
  document.querySelectorAll('button[data-conciliar]').forEach(btn => btn.onclick = () => acaoLancamento(Number(btn.dataset.conciliar), 'conciliar', renderLancamentos));
  document.querySelectorAll('button[data-excluir]').forEach(btn => btn.onclick = () => acaoLancamento(Number(btn.dataset.excluir), 'excluir', renderLancamentos));
  document.querySelectorAll('button[data-estornar]').forEach(btn => btn.onclick = () => acaoLancamento(Number(btn.dataset.estornar), 'estornar', renderLancamentos));
}
function tdNatureza(n) { return n === 'receita' ? 'Receita' : n === 'despesa' ? 'Despesa' : 'Transferência'; }

function acaoLancamento(id, acao, refresh) {
  const mapa = {
    conciliar: { canal: 'lancamentos:conciliar', confirma: null, ok: 'Lançamento conciliado.' },
    excluir:   { canal: 'lancamentos:excluir',   confirma: 'Excluir este lançamento? (só é permitido se não estiver conciliado)', ok: 'Lançamento excluído.' },
    estornar:  { canal: 'lancamentos:estornar',  confirma: 'Estornar este lançamento? Será criado um lançamento inverso (receita ↔ despesa, mesmo valor) e o original será marcado como estornado.', ok: 'Estorno criado.' },
  };
  const m = mapa[acao];
  if (!m) return;
  if (m.confirma && !confirm(m.confirma)) return;
  try {
    const out = api(m.canal, { id });
    if (globalThis.toastOk) toastOk(m.ok);
    if (acao === 'estornar' && out && out.idEstorno) {
      if (globalThis.toastInfo) toastInfo(`Lançamento inverso #${out.idEstorno} criado.`);
    }
    refresh();
  } catch (err) {
    if (globalThis.toastErr) toastErr('Erro: ' + err.message);
  }
}

function formEditarLancamento(id, clientes, projetos, centrosCusto) {
  const r = api('lancamentos:obter', { id });
  if (!r) { if (globalThis.toastErr) toastErr('Lançamento não encontrado.'); return; }
  // r: 0=id 1=contexto 2=conta 3=categoria 4=cliente 5=projeto 6=cc 7=natureza
  //    8=valor 9=data_comp 10=data_venc 11=desc 12=obs 13=transf 14=status ...
  if (r[14] === 'conciliado') { if (globalThis.toastErr) toastErr('Conciliado não pode ser editado. Use estornar.'); return; }
  if (r[14] === 'estornado') { if (globalThis.toastErr) toastErr('Estornado não pode ser editado.'); return; }
  const dataComp = r[9] || '';
  const valor = (Number(r[8]) / 100).toFixed(2).replace('.', ',');
  const natureza = r[7];
  const contaId = r[2];
  const catId = r[3];
  const cliId = r[4];
  const projId = r[5];
  const ccId = r[6];
  app.innerHTML = `<div class="panel"><h1>Editar lançamento #${id}</h1><form id="form"><div class="form-grid">
    <label>Descrição<input name="descricao" required value="${String(r[11] || '').replaceAll('"','&quot;')}"></label>
    <label>Natureza<select name="natureza"><option value="despesa" ${natureza === 'despesa' ? 'selected' : ''}>Despesa</option><option value="receita" ${natureza === 'receita' ? 'selected' : ''}>Receita</option></select></label>
    <label>Valor (R$)<input name="valor" inputmode="decimal" required value="${valor}"></label>
    <label>Data<input type="date" name="data" required value="${dataComp}"></label>
    <label>Conta<select name="conta">${contas.map((c) => `<option value="${c[0]}" ${c[0] === contaId ? 'selected' : ''}>${String(c[2] || '').replace(/[<>&]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c]))}</option>`).join('')}</select></label>
    <label>Categoria<select name="categoria"><option value="">Sem categoria</option>${categorias.map((c) => `<option value="${c[0]}" ${c[0] === catId ? 'selected' : ''}>${String(c[2] || '').replace(/[<>&]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c]))}</option>`).join('')}</select></label>
    <label>Cliente<select name="cliente"><option value="">Sem cliente</option>${clientes.map((c) => `<option value="${c[0]}" ${c[0] === cliId ? 'selected' : ''}>${String(c[2] || '').replace(/[<>&]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c]))}</option>`).join('')}</select></label>
    <label>Projeto<select name="projeto"><option value="">Sem projeto</option>${projetos.map((c) => `<option value="${c[0]}" ${c[0] === projId ? 'selected' : ''}>${String(c[2] || '').replace(/[<>&]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c]))}</option>`).join('')}</select></label>
    <label>Centro de custo<select name="centro_custo"><option value="">Sem centro</option>${centrosCusto.map((c) => `<option value="${c[0]}" ${c[0] === ccId ? 'selected' : ''}>${String(c[2] || '').replace(/[<>&]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c]))}</option>`).join('')}</select></label>
  </div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Salvar</button></div></form></div>`;
  $('#cancel').onclick = renderLancamentos;
  $('#form').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const campos = {
      contaId: Number(f.get('conta')),
      categoriaId: f.get('categoria') ? Number(f.get('categoria')) : null,
      clienteId: f.get('cliente') ? Number(f.get('cliente')) : null,
      projetoId: f.get('projeto') ? Number(f.get('projeto')) : null,
      centroCustoId: f.get('centro_custo') ? Number(f.get('centro_custo')) : null,
      natureza: f.get('natureza'),
      valor_centavos: Math.round(Number(String(f.get('valor')).replace(',', '.')) * 100),
      data_competencia: f.get('data'),
      descricao: f.get('descricao'),
    };
    try {
      api('lancamentos:editar', { id, campos });
      if (globalThis.toastOk) toastOk('Lançamento atualizado.');
      renderLancamentos();
    } catch (err) {
      if (globalThis.toastErr) toastErr('Erro: ' + err.message);
    }
  };
}

function formLancamento(clientes, projetos, centrosCusto) {
  if (!contas.length) { app.innerHTML = '<div class="error">Cadastre uma conta antes de registrar lançamentos.</div>'; return; }
  app.innerHTML = `<div class="panel"><h1>Novo lançamento</h1><form id="form"><div class="form-grid"><label>Descrição<input name="descricao" required></label><label>Natureza<select name="natureza"><option value="despesa">Despesa</option><option value="receita">Receita</option></select></label><label>Valor (R$)<input name="valor" inputmode="decimal" required></label><label>Data<input type="date" name="data" required value="${new Date().toISOString().slice(0,10)}"></label><label>Conta<select name="conta">${contas.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Categoria<select name="categoria"><option value="">Sem categoria</option>${categorias.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Cliente<select name="cliente"><option value="">Sem cliente</option>${clientes.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Projeto<select name="projeto"><option value="">Sem projeto</option>${projetos.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Centro de custo<select name="centro_custo"><option value="">Sem centro</option>${centrosCusto.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Salvar</button></div></form></div>`;
  $('#cancel').onclick = renderLancamentos;
  $('#form').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); try { api('lancamentos:criar', { contextoId, contaId: Number(f.get('conta')), categoriaId: f.get('categoria') ? Number(f.get('categoria')) : null, clienteId: f.get('cliente') ? Number(f.get('cliente')) : null, projetoId: f.get('projeto') ? Number(f.get('projeto')) : null, centroCustoId: f.get('centro_custo') ? Number(f.get('centro_custo')) : null, natureza: f.get('natureza'), valorCentavos: Math.round(Number(String(f.get('valor')).replace(',', '.')) * 100), dataCompetencia: f.get('data'), descricao: f.get('descricao') }); if (globalThis.toastOk) toastOk('Lançamento criado.'); renderLancamentos(); } catch (err) { if (globalThis.toastErr) toastErr('Erro: ' + err.message); } };
}

function formTransferencia() {
  if (contas.length < 2) { app.innerHTML = '<div class="error">Cadastre pelo menos 2 contas para transferir.</div>'; return; }
  app.innerHTML = `<div class="panel"><h1>Transferência entre contas</h1><form id="form"><div class="form-grid"><label>Conta origem<select name="origem">${contas.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Conta destino<select name="destino">${contas.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Valor (R$)<input name="valor" inputmode="decimal" required></label><label>Data<input type="date" name="data" required value="${new Date().toISOString().slice(0,10)}"></label><label>Descrição<input name="descricao" value="Transferência"></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Transferir</button></div></form></div>`;
  $('#cancel').onclick = renderLancamentos;
  $('#form').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); try { api('transferencias:criar', { contextoId, contaOrigemId: Number(f.get('origem')), contaDestinoId: Number(f.get('destino')), valorCentavos: Math.round(Number(String(f.get('valor')).replace(',', '.')) * 100), dataCompetencia: f.get('data'), descricao: f.get('descricao') || 'Transferência' }); if (globalThis.toastOk) toastOk('Transferência registrada.'); renderLancamentos(); } catch (err) { if (globalThis.toastErr) toastErr('Erro: ' + err.message); } };
}

function formBaixa(lancamentoId) {
  const saldo = api('baixas:saldo', { lancamentoId });
  const baixas = api('baixas:listar', { lancamentoId });
  app.innerHTML = `<div class="panel"><h1>Baixas do lançamento #${lancamentoId}</h1><p class="subtitle">Saldo em aberto: <strong>${money(saldo)}</strong></p><form id="form-nova"><div class="form-grid"><label>Valor (R$)<input name="valor" inputmode="decimal" required value="${(saldo/100).toFixed(2)}"></label><label>Data<input type="date" name="data" required value="${new Date().toISOString().slice(0,10)}"></label><label>Forma<input name="forma" value="pix"></label><label>Observações<input name="obs"></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Registrar baixa</button></div></form><table style="margin-top:16px"><thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Obs</th></tr></thead><tbody>${baixas.map((b) => `<tr><td>${b[3]}</td><td>${money(b[2])}</td><td>${b[4]}</td><td>${b[5] || ''}</td></tr>`).join('')}</tbody></table></div>`;
  $('#cancel').onclick = renderLancamentos;
  $('#form-nova').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); try { api('baixas:registrar', { lancamentoId, valorCentavos: Math.round(Number(String(f.get('valor')).replace(',', '.')) * 100), dataBaixa: f.get('data'), formaPagamento: f.get('forma') || 'pix', observacoes: f.get('obs') || '' }); if (globalThis.toastOk) toastOk('Baixa registrada.'); renderLancamentos(); } catch (err) { if (globalThis.toastErr) toastErr('Erro: ' + err.message); } };
}

function renderTransferencias() {
  const transfs = api('transferencias:listar', { contextoId });
  // Schema: 0=id 1=contexto 2=lanc_origem 3=lanc_destino 4=valor 5=data
  //   6=criado_em 7=conta_origem_nome 8=conta_destino_nome
  const linhas = transfs.map((t) => {
    const data = t[5] || '';
    const origem = t[7] || '—';
    const destino = t[8] || '—';
    const valor = t[4];
    return `<tr><td>${data}</td><td>${origem}</td><td>${destino}</td><td>${money(valor)}</td><td><button class="button danger" data-excluir="${t[0]}">Excluir</button></td></tr>`;
  }).join('');
  app.innerHTML = `<span class="eyebrow">CADASTROS</span><h1>Transferências</h1><p class="subtitle">Débitos e créditos vinculados entre contas do mesmo contexto. Excluir apenas desvincula os 2 lançamentos (eles permanecem). Use cascade se quiser apagar também.</p><div class="panel"><table><thead><tr><th>Data</th><th>Conta origem</th><th>Conta destino</th><th>Valor</th><th>Ação</th></tr></thead><tbody>${linhas}</tbody></table>${!transfs.length ? '<div class="empty"><div class="icon">◌</div>Nenhuma transferência. Cadastre via tela de Lançamentos > "Transferir entre contas".</div>' : ''}</div>`;
  document.querySelectorAll('button[data-excluir]').forEach(btn => btn.onclick = () => {
    const id = Number(btn.dataset.excluir);
    if (!confirm('Excluir esta transferência?\n\nPor padrão, apenas desvincula os 2 lançamentos (eles continuam existindo como lançamentos independentes). Clique OK e confirme o cascade para apagar TUDO.')) return;
    try {
      api('transferencias:excluir', { id });
      if (globalThis.toastOk) toastOk('Transferência desvinculada (lançamentos preservados).');
      renderTransferencias();
    } catch (e) {
      if (confirm(`${e.message}\n\nApagar TUDO em cascata (lançamentos + baixas)? Esta ação é IRREVERSÍVEL.`)) {
        try {
          api('transferencias:excluir', { id, cascade: true });
          if (globalThis.toastOk) toastOk('Transferência e lançamentos apagados.');
          renderTransferencias();
        } catch (e2) { if (globalThis.toastErr) toastErr('Erro: ' + e2.message); }
      }
    }
  });
}

function renderBaixas() {
  const data = api('lancamentos:listar', { contextoId });
  // Schema detalhado: 0=id 7=natureza 8=valor 9=data_competencia 11=desc 14=status
  app.innerHTML = `<span class="eyebrow">FINANCEIRO</span><h1>Baixas e saldos em aberto</h1><p class="subtitle">Pagamentos parciais e totais. Não excede o valor original.</p><div class="panel"><table><thead><tr><th>Lançamento</th><th>Vencimento</th><th>Valor original</th><th>Saldo em aberto</th><th>Status</th><th>Ação</th></tr></thead><tbody>${data.map((l) => { const id = l[0]; const saldo = api('baixas:saldo', { lancamentoId: id }); const desc = String(l[11] || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c])); return `<tr><td>${desc}</td><td>${l[9] || ''}</td><td>${money(l[8])}</td><td>${money(saldo)}</td><td>${l[14] || 'aberto'}</td><td><button class="button ghost" data-baixa="${id}">Lançar baixa</button></td></tr>`; }).join('')}</tbody></table>${!data.length ? '<div class="empty"><div class="icon">◌</div>Nenhum lançamento para dar baixa.</div>' : ''}</div>`;
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

function trocarContextoAtivo(novoId, api) {
  if (!Number.isInteger(novoId)) return;
  contextoId = novoId;
  // Recarrega dashboard no novo contexto
  const view = document.querySelector('.nav-button.active')?.dataset?.view || 'dashboard';
  render(view);
  // Re-renderiza o seletor de contexto no header
  renderHeaderPillContexto();
  // Re-checa auto-update (nao muda nada, mas boa pratica)
}
