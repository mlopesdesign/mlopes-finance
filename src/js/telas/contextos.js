// MLopes Finance — Tela de Contextos Financeiros (CRUD)
// "Pessoal", "ML Lopes Design", "Filial SP" etc. Cada contexto isola saldos.

let _contextoId = null;
let _api = null;
let _onChange = null;

export function renderContextos(contextoId, api, onChange = null) {
  _contextoId = contextoId;
  _api = api;
  _onChange = onChange;

  const incluirInativos = (sessionStorage.getItem('mlopes-ctx-show-inativos') === '1');
  const contextos = api('contextos:listar', { incluirInativos });
  const resumos = contextos.map(c => ({ ...c, resumo: api('contextos:resumo', { contextoId: c[0] }) }));

  const app = document.getElementById('app');
  app.innerHTML = `
    <span class="eyebrow">FASE 1 — FECHADA</span>
    <h1>Contextos <em>financeiros</em></h1>
    <p class="subtitle">Cada contexto isola saldos. Use para separar pessoa física, empresa, projeto ou filial.</p>

    <div class="panel">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h2>${resumos.length} contexto(s)</h2>
        <div style="display:flex; gap:8px;">
          <label class="checkbox" style="display:flex; align-items:center; gap:6px; font-size:13px;">
            <input type="checkbox" id="ctx-show-inativos" ${incluirInativos ? 'checked' : ''} />
            Mostrar inativos
          </label>
          <button class="button" id="ctx-novo">Novo contexto</button>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr><th>Nome</th><th>Descricao</th><th style="text-align:right;">Receitas</th><th style="text-align:right;">Despesas</th><th style="text-align:right;">Saldo</th><th style="text-align:right;">Lancamentos</th><th>Status</th><th>Acoes</th></tr>
          </thead>
          <tbody>
            ${resumos.map((c) => {
              const [id, nome, descricao, ativo, criadoEm, resumo] = [c[0], c[1], c[2], c[3], c[4], c.resumo];
              const isAtual = id === _contextoId;
              const status = ativo ? '<span class="pill is-static" style="color:var(--positive)">Ativo</span>' : '<span class="pill warn">Inativo</span>';
              return `
                <tr>
                  <td><strong>${String(nome).replaceAll('<','&lt;')}</strong>${isAtual ? ' <span class="pill is-static" style="margin-left:4px;">Atual</span>' : ''}</td>
                  <td style="color: var(--muted); font-size: 13px;">${String(descricao || '').replaceAll('<','&lt;') || '—'}</td>
                  <td style="text-align:right; color: var(--positive);">${money(resumo?.receitas ?? 0)}</td>
                  <td style="text-align:right; color: var(--negative);">${money(resumo?.despesas ?? 0)}</td>
                  <td style="text-align:right; font-weight:600; color: ${(resumo?.saldo ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)'};">${money(resumo?.saldo ?? 0)}</td>
                  <td style="text-align:right; color: var(--muted);">${resumo?.lancamentos ?? 0}</td>
                  <td>${status}</td>
                  <td>
                    ${!isAtual ? `<button class="button secondary ctx-usar" data-id="${id}" style="padding:4px 8px; font-size:12px;">Usar</button>` : ''}
                    <button class="button secondary ctx-editar" data-id="${id}" style="padding:4px 8px; font-size:12px;">Editar</button>
                    <button class="button secondary ctx-toggle" data-id="${id}" data-ativo="${ativo}" style="padding:4px 8px; font-size:12px;">${ativo ? 'Desativar' : 'Reativar'}</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div id="ctx-form-host"></div>
  `;

  // Eventos
  document.getElementById('ctx-novo').onclick = () => formContexto(null);
  document.getElementById('ctx-show-inativos').onchange = (e) => {
    sessionStorage.setItem('mlopes-ctx-show-inativos', e.target.checked ? '1' : '0');
    renderContextos(_contextoId, _api, _onChange);
  };
  document.querySelectorAll('.ctx-editar').forEach(btn => {
    btn.onclick = () => formContexto(Number(btn.dataset.id));
  });
  document.querySelectorAll('.ctx-toggle').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      const ativo = btn.dataset.ativo === '1';
      const acao = ativo ? 'desativar' : 'reativar';
      if (!confirm(`${acao.charAt(0).toUpperCase() + acao.slice(1)} este contexto? Os dados nao serao apagados, apenas ${ativo ? 'marcados como inativos' : 'reativados'}.`)) return;
      try {
        _api('contextos:alternarAtivo', { id });
        renderContextos(_contextoId, _api, _onChange);
      } catch (e) { alert('Erro: ' + e.message); }
    };
  });
  document.querySelectorAll('.ctx-usar').forEach(btn => {
    btn.onclick = () => {
      if (_onChange) _onChange(Number(btn.dataset.id));
    };
  });
}

function money(centavos) {
  return (Number(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formContexto(id) {
  const ctx = id ? _api('contextos:obter', { id }) : null;
  const host = document.getElementById('ctx-form-host');
  if (!host) return;
  const isEdit = !!id;
  const nome = ctx?.[1] || '';
  const descricao = ctx?.[2] || '';
  host.innerHTML = `
    <div class="panel">
      <h2>${isEdit ? 'Editar' : 'Novo'} contexto</h2>
      <form id="ctx-form">
        <div class="form-grid">
          <label>Nome *<input name="nome" required maxlength="60" value="${String(nome).replaceAll('"', '&quot;')}" placeholder="Ex: Pessoal, ML Lopes Design, Filial SP" /></label>
          <label>Descricao<input name="descricao" maxlength="200" value="${String(descricao).replaceAll('"', '&quot;')}" placeholder="Opcional" /></label>
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" id="ctx-cancelar">Cancelar</button>
          <button type="submit" class="button">${isEdit ? 'Salvar' : 'Criar'}</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('ctx-form').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = { nome: f.get('nome').trim(), descricao: f.get('descricao').trim() };
    if (isEdit) payload.id = id;
    try {
      if (isEdit) _api('contextos:atualizar', payload);
      else _api('contextos:criar', payload);
      renderContextos(_contextoId, _api, _onChange);
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };
  document.getElementById('ctx-cancelar').onclick = () => { host.innerHTML = ''; };
}
