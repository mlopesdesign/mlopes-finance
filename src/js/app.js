import { criarApi } from './backend/servidor.js';
import { migrar } from './backend/migracoes.js';
import { APP_VERSION as AMBIENTE_VERSION, abrirBancoLocal } from './backend/ambiente.js';
import { aplicarTemaDoBanco, DEFAULTS as TEMA_DEFAULTS } from './tema.js';
import { renderConfiguracoes } from './telas/configuracoes.js';

const APP_VERSION = '0.4.1';
const FALLBACK_VERSION = AMBIENTE_VERSION;
let api; let contextoId; let contas = []; let categorias = [];
const $ = (s) => document.querySelector(s); const app = $('#app');
const money = (c) => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const rows = (data) => data.map((r) => `<tr>${r.map((v) => `<td>${String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</td>`).join('')}</tr>`).join('');

async function boot() {
  Neutralino.init(); await new Promise((resolve) => setTimeout(resolve, 500));
  const SQL = await globalThis.initSqlJs({ locateFile: (f) => `js/vendor/${f}` });
  const schema = await (await fetch('js/backend/schema.sql')).text();
  const local = await abrirBancoLocal(SQL, schema);
  const versaoAntes = Number(local.db.exec("SELECT valor FROM meta WHERE chave = 'schema_version'")[0]?.values?.[0]?.[0] ?? '0');
  migrar(local.db);
  const versaoDepois = Number(local.db.exec("SELECT valor FROM meta WHERE chave = 'schema_version'")[0]?.values?.[0]?.[0] ?? '0');
  if (versaoDepois > versaoAntes) await local.persistir();
  // Aplica tema ANTES do primeiro render, lendo direto do DB
  aplicarTemaDoBanco(local.db);
  api = criarApi(local.db, () => local.persistir());
  const contexts = api('contextos:listar');
  if (!contexts.length) { contextoId = api('contextos:criar', { nome: 'Meu contexto', descricao: 'Contexto criado nesta instalaÃƒÂ§ÃƒÂ£o' }); await local.persistir(); } else contextoId = contexts[0][0];
  // Header dinÃƒÂ¢mico: nome, versÃƒÂ£o, banco, toggle de tema
  renderHeader(local.arquivo);
  document.querySelectorAll('.nav-button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.nav-button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    render(b.dataset.view);
  }));
  render('dashboard');
}

function renderHeader(dbPath) {
  const cfg = api('configuracoes:listar');
  const nome = cfg.nome_exibicao?.valor || 'MLopes Finance';
  const tema = cfg.tema?.valor || TEMA_DEFAULTS.tema;
  const status = document.getElementById('status');
  const actions = document.getElementById('topbar-actions');
  if (status) status.textContent = `VersÃƒÂ£o ${APP_VERSION} Ã‚Â· ${dbPath}`;
  if (actions) {
    actions.innerHTML = `
      <button class="pill" id="toggle-tema" title="Alternar tema"><span class="dot"></span>${tema === 'dark' ? 'Ã¢ËœÂ¾ Escuro' : 'Ã¢Ëœâ‚¬ Claro'}</button>
      <span class="pill is-static" title="VersÃƒÂ£o do aplicativo">VERSÃƒÆ’O ${APP_VERSION}</span>
    `;
    document.getElementById('toggle-tema').onclick = () => {
      const novo = api('configuracoes:obter', { chave: 'tema' }).valor === 'dark' ? 'light' : 'dark';
      api('configuracoes:salvar', { chave: 'tema', valor: novo, tipo: 'texto' });
      location.reload();
    };
  }
  // Atualiza o nome na topbar
  const strong = document.querySelector('.topbar strong');
  if (strong) strong.textContent = nome;
}

function render(view) {
  if (view === 'dashboard') return renderDashboard();
  if (view === 'lancamentos') return renderLancamentos();
  if (view === 'contas') return renderContas();
  if (view === 'categorias') return renderCategorias();
  if (view === 'configuracoes') return renderConfiguracoes(contextoId, api);
  return renderDashboard();
}

function renderDashboard() {
  const s = api('dashboard:resumo', { contextoId });
  app.innerHTML = `
    <span class="eyebrow">VISÃƒÆ’O GERAL</span>
    <h1>Seu dinheiro, no seu <em>ritmo</em>.</h1>
    <p class="subtitle">Acompanhe o movimento do contexto financeiro selecionado.</p>
    <div class="cards">
      <div class="card"><span class="card-label">Receitas</span><span class="card-value positive">${money(s.receitas)}</span><span class="card-sub">no perÃƒÂ­odo</span></div>
      <div class="card"><span class="card-label">Despesas</span><span class="card-value negative">${money(s.despesas)}</span><span class="card-sub">no perÃƒÂ­odo</span></div>
      <div class="card"><span class="card-label">Saldo</span><span class="card-value">${money(s.saldo)}</span><span class="card-sub">resultado</span></div>
      <div class="card"><span class="card-label">Contas</span><span class="card-value">${api('contas:listar', { contextoId }).length}</span><span class="card-sub">cadastradas</span></div>
    </div>
    <div class="panel">
      <h2>PrÃƒÂ³ximo passo</h2>
      <p style="color: var(--muted); margin: 0;">Cadastre uma conta e registre seu primeiro lanÃƒÂ§amento. Os dados ficam no banco local desta instalaÃƒÂ§ÃƒÂ£o.</p>
    </div>`;
}

function renderContas() {
  contas = api('contas:listar', { contextoId });
  app.innerHTML = `<div class="toolbar"><div><h1>Contas</h1><p class="subtitle">Contas bancÃƒÂ¡rias, cartÃƒÂµes e investimentos.</p></div><button class="button" id="new">Nova conta</button></div><div class="panel"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Saldo inicial</th></tr></thead><tbody>${rows(contas)}</tbody></table>${!contas.length ? '<div class="empty"><div class="icon">Ã¢â€”Å’</div>Nenhuma conta cadastrada.</div>' : ''}</div>`;
  $('#new').onclick = formConta;
}

function formConta() {
  app.innerHTML = `<div class="panel"><h1>Nova conta</h1><form id="form"><div class="form-grid"><label>Nome<input name="nome" required></label><label>Tipo<select name="tipo"><option value="bancaria">Conta bancÃƒÂ¡ria</option><option value="cartao">CartÃƒÂ£o de crÃƒÂ©dito</option><option value="investimento">Investimento</option></select></label><label>Saldo inicial (R$)<input name="saldo" inputmode="decimal" value="0"></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Salvar</button></div></form></div>`;
  $('#cancel').onclick = renderContas;
  $('#form').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); api('contas:criar', { contextoId, nome: f.get('nome'), tipo: f.get('tipo'), saldoInicialCentavos: Math.round(Number(String(f.get('saldo')).replace(',', '.')) * 100) }); renderContas(); };
}

function renderCategorias() {
  categorias = api('categorias:listar', { contextoId });
  app.innerHTML = `<div class="toolbar"><div><h1>Categorias</h1><p class="subtitle">ClassificaÃƒÂ§ÃƒÂ£o editÃƒÂ¡vel para este contexto.</p></div><button class="button" id="new">Nova categoria</button></div><div class="panel"><table><thead><tr><th>Nome</th><th>Natureza</th></tr></thead><tbody>${rows(categorias)}</tbody></table>${!categorias.length ? '<div class="empty"><div class="icon">Ã¢â€”Å’</div>Nenhuma categoria cadastrada.</div>' : ''}</div>`;
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
  const data = api('lancamentos:listar', { contextoId });
  app.innerHTML = `<div class="toolbar"><div><h1>LanÃƒÂ§amentos</h1><p class="subtitle">Registre receitas e despesas com rastreabilidade.</p></div><button class="button" id="new">Novo lanÃƒÂ§amento</button></div><div class="panel"><table><thead><tr><th>Data</th><th>DescriÃƒÂ§ÃƒÂ£o</th><th>Conta</th><th>Natureza</th><th>Valor</th><th>Status</th></tr></thead><tbody>${data.map((r) => `<tr><td>${r[5]}</td><td>${r[7]}</td><td>${r[11]}</td><td>${r[4]}</td><td class="${r[4] === 'receita' ? 'positive' : 'negative'}">${money(r[6])}</td><td>${r[9]}</td></tr>`).join('')}</tbody></table>${!data.length ? '<div class="empty"><div class="icon">Ã¢â€”Å’</div>Nenhum lanÃƒÂ§amento cadastrado.</div>' : ''}</div>`;
  $('#new').onclick = formLancamento;
}

function formLancamento() {
  if (!contas.length) { app.innerHTML = '<div class="error">Cadastre uma conta antes de registrar lanÃƒÂ§amentos.</div>'; return; }
  app.innerHTML = `<div class="panel"><h1>Novo lanÃƒÂ§amento</h1><form id="form"><div class="form-grid"><label>DescriÃƒÂ§ÃƒÂ£o<input name="descricao" required></label><label>Natureza<select name="natureza"><option value="despesa">Despesa</option><option value="receita">Receita</option></select></label><label>Valor (R$)<input name="valor" inputmode="decimal" required></label><label>Data<input type="date" name="data" required value="${new Date().toISOString().slice(0,10)}"></label><label>Conta<select name="conta">${contas.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label><label>Categoria<select name="categoria"><option value="">Sem categoria</option>${categorias.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Salvar</button></div></form></div>`;
  $('#cancel').onclick = renderLancamentos;
  $('#form').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); api('lancamentos:criar', { contextoId, contaId: Number(f.get('conta')), categoriaId: f.get('categoria') ? Number(f.get('categoria')) : null, natureza: f.get('natureza'), valorCentavos: Math.round(Number(String(f.get('valor')).replace(',', '.')) * 100), dataCompetencia: f.get('data'), descricao: f.get('descricao') }); renderLancamentos(); };
}

boot().catch((e) => { const s = document.getElementById('status'); if (s) s.textContent = 'Falha ao abrir o banco'; const a = document.getElementById('app'); if (a) a.innerHTML = `<div class="error">${e.message}</div>`; });


