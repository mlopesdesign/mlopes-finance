// MLopes Finance — Tela de Relatórios e Balancete (Fase 6)

let _contextoId = null;
let _api = null;
let _estado = {
  tipo: 'este_mes',
  customInicio: '',
  customFim: '',
  agrupamento: 'categoria',
  comparativo: true,
};

const TIPOS_PERIODO = [
  { id: 'este_mes',     label: 'Este mês' },
  { id: 'mes_passado',   label: 'Mês passado' },
  { id: 'este_ano',     label: 'Este ano' },
  { id: 'ano_passado',   label: 'Ano passado' },
  { id: 'ultimos_12m',  label: 'Últimos 12 meses' },
  { id: 'custom',       label: 'Personalizado' },
];

const AGRUPAMENTOS = [
  { id: 'categoria',    label: 'Categoria' },
  { id: 'conta',        label: 'Conta' },
  { id: 'cliente',      label: 'Cliente' },
  { id: 'projeto',      label: 'Projeto' },
  { id: 'centro_custo', label: 'Centro de custo' },
  { id: 'tag',          label: 'Tag' },
];

export function renderRelatorios(contextoId, api) {
  _contextoId = contextoId;
  _api = api;

  const app = document.getElementById('app');
  app.innerHTML = `
    <span class="eyebrow">FASE 6</span>
    <h1>Relatórios e <em>balancete</em></h1>
    <p class="subtitle">Receitas, despesas e saldo por período. Regime de competência.</p>

    <div class="panel" id="filtros-panel">
      <h2>Filtros</h2>
      <div class="form-grid">
        <label>Período
          <select id="rep-tipo">
            ${TIPOS_PERIODO.map(t => `<option value="${t.id}" ${t.id === _estado.tipo ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </label>
        <label id="rep-custom-wrap" style="display:${_estado.tipo === 'custom' ? '' : 'none'};">
          De <input type="date" id="rep-inicio" value="${_estado.customInicio}" />
          até <input type="date" id="rep-fim" value="${_estado.customFim}" />
        </label>
        <label>Agrupar por
          <select id="rep-agrupamento">
            ${AGRUPAMENTOS.map(a => `<option value="${a.id}" ${a.id === _estado.agrupamento ? 'selected' : ''}>${a.label}</option>`).join('')}
          </select>
        </label>
        <label class="checkbox">
          <input type="checkbox" id="rep-comparativo" ${_estado.comparativo ? 'checked' : ''} />
          Comparar com período anterior
        </label>
      </div>
      <div class="form-actions" style="margin-top: 12px;">
        <button class="button" id="rep-gerar">Gerar relatório</button>
        <button class="button secondary" id="rep-csv" disabled>Exportar CSV</button>
        <button class="button secondary" id="rep-print" disabled>Imprimir / PDF</button>
      </div>
      <div id="rep-status" class="field-help" style="margin-top: 8px;"></div>
    </div>

    <div id="rep-resultado"></div>
  `;

  document.getElementById('rep-tipo').onchange = (e) => {
    _estado.tipo = e.target.value;
    document.getElementById('rep-custom-wrap').style.display = _estado.tipo === 'custom' ? '' : 'none';
  };
  document.getElementById('rep-inicio').onchange = (e) => { _estado.customInicio = e.target.value; };
  document.getElementById('rep-fim').onchange = (e) => { _estado.customFim = e.target.value; };
  document.getElementById('rep-agrupamento').onchange = (e) => { _estado.agrupamento = e.target.value; };
  document.getElementById('rep-comparativo').onchange = (e) => { _estado.comparativo = e.target.checked; };
  document.getElementById('rep-gerar').onclick = gerar;
  document.getElementById('rep-csv').onclick = exportarCSV;
  document.getElementById('rep-print').onclick = imprimir;

  // Gera automaticamente
  gerar();
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('rep-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--danger)' : 'var(--muted)';
}

function gerar() {
  if (_estado.tipo === 'custom' && (!_estado.customInicio || !_estado.customFim)) {
    setStatus('Informe data de início e fim para o período personalizado.', true);
    return;
  }
  setStatus('Gerando relatório...');
  const d = {
    contextoId: _contextoId,
    tipo: _estado.tipo,
    agrupamento: _estado.agrupamento,
  };
  if (_estado.tipo === 'custom') {
    d.customInicio = _estado.customInicio;
    d.customFim = _estado.customFim;
  }
  let out;
  try {
    out = _estado.comparativo
      ? _api('relatorios:comparativo', d)
      : { atual: _api('relatorios:balancete', { contextoId: _contextoId, dataInicio: '', dataFim: '', agrupamento: _estado.agrupamento }), tipo: _estado.tipo };
  } catch (e) {
    setStatus('Erro: ' + e.message, true);
    return;
  }

  // Se nao for comparativo, recalcula o balancete com periodo correto via comparativo
  if (!_estado.comparativo) {
    out.atual = _api('relatorios:comparativo', { ...d }).atual;
  }

  _ultimoRelatorio = out;
  renderResultado(out);
  document.getElementById('rep-csv').disabled = false;
  document.getElementById('rep-print').disabled = false;
  setStatus(`Período: ${out.atual.label} · ${out.atual.totais.lancamentos} lançamentos · ${out.atual.linhas.length} grupos.`);
}

let _ultimoRelatorio = null;

function money(centavos) {
  return (Number(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderKpis(blc) {
  return `
    <div class="cards">
      <div class="card"><span class="card-label">Receitas</span><span class="card-value positive">${money(blc.totais.totalReceitas)}</span><span class="card-sub">no período</span></div>
      <div class="card"><span class="card-label">Despesas</span><span class="card-value negative">${money(blc.totais.totalDespesas)}</span><span class="card-sub">no período</span></div>
      <div class="card"><span class="card-label">Saldo</span><span class="card-value ${blc.totais.saldo >= 0 ? 'positive' : 'negative'}">${money(blc.totais.saldo)}</span><span class="card-sub">resultado</span></div>
    </div>
  `;
}

function renderTabela(blc, titulo) {
  if (!blc.linhas.length) {
    return `<div class="panel"><h2>${titulo}</h2><p class="empty">Nenhum lançamento no período.</p></div>`;
  }
  return `
    <div class="panel">
      <h2>${titulo} <small style="color: var(--muted); font-weight: normal;">(${blc.label})</small></h2>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr><th>Grupo</th><th style="text-align:right;">Receitas</th><th style="text-align:right;">Despesas</th><th style="text-align:right;">Saldo</th><th style="text-align:right;">Lançamentos</th></tr>
          </thead>
          <tbody>
            ${blc.linhas.map((l) => `
              <tr>
                <td>${l.grupo}</td>
                <td style="text-align:right; color: var(--positive);">${l.totalReceitas ? money(l.totalReceitas) : '—'}</td>
                <td style="text-align:right; color: var(--negative);">${l.totalDespesas ? money(l.totalDespesas) : '—'}</td>
                <td style="text-align:right; font-weight: 600; color: ${l.saldo >= 0 ? 'var(--positive)' : 'var(--negative)'};">${money(l.saldo)}</td>
                <td style="text-align:right; color: var(--muted);">${l.lancamentos}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: 700; border-top: 2px solid var(--line);">
              <td>TOTAL</td>
              <td style="text-align:right; color: var(--positive);">${money(blc.totais.totalReceitas)}</td>
              <td style="text-align:right; color: var(--negative);">${money(blc.totais.totalDespesas)}</td>
              <td style="text-align:right; color: ${blc.totais.saldo >= 0 ? 'var(--positive)' : 'var(--negative)'};">${money(blc.totais.saldo)}</td>
              <td style="text-align:right;">${blc.totais.lancamentos}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

function renderDelta(delta) {
  const fmtDelta = (c, isCurrency = true) => {
    const sinal = c > 0 ? '+' : '';
    return (isCurrency ? sinal + money(Math.abs(c)).replace('R$', 'R$') : sinal + c);
  };
  const cor = (c, invert = false) => {
    if (c === 0) return 'var(--muted)';
    const positivo = invert ? c < 0 : c > 0;
    return positivo ? 'var(--positive)' : 'var(--negative)';
  };
  return `
    <div class="panel">
      <h2>Variação vs período anterior</h2>
      <div class="cards">
        <div class="card">
          <span class="card-label">Δ Receitas</span>
          <span class="card-value" style="color: ${cor(delta.totalReceitas, false)};">${fmtDelta(delta.totalReceitas)}</span>
          <span class="card-sub">comparado ao anterior</span>
        </div>
        <div class="card">
          <span class="card-label">Δ Despesas</span>
          <span class="card-value" style="color: ${cor(delta.totalDespesas, true)};">${fmtDelta(delta.totalDespesas)}</span>
          <span class="card-sub">invertido: mais despesa = pior</span>
        </div>
        <div class="card">
          <span class="card-label">Δ Saldo</span>
          <span class="card-value" style="color: ${cor(delta.saldo, false)};">${fmtDelta(delta.saldo)}</span>
          <span class="card-sub">variação do resultado</span>
        </div>
      </div>
    </div>
  `;
}

function renderResultado(out) {
  const div = document.getElementById('rep-resultado');
  let html = renderKpis(out.atual);
  html += renderTabela(out.atual, 'Balancete atual');
  if (out.anterior) {
    html += renderTabela(out.anterior, 'Balancete anterior');
    if (out.delta) html += renderDelta(out.delta);
  }
  div.innerHTML = html;
}

function exportarCSV() {
  if (!_ultimoRelatorio) return;
  const csv = _api('relatorios:exportarCSV', {
    contextoId: _contextoId,
    dataInicio: _ultimoRelatorio.atual.dataInicio,
    dataFim: _ultimoRelatorio.atual.dataFim,
    agrupamento: _ultimoRelatorio.agrupamento,
  });
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const hoje = new Date().toISOString().slice(0, 10);
  a.download = `balancete-${_ultimoRelatorio.agrupamento}-${hoje}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  setStatus('CSV exportado: ' + a.download);
}

function imprimir() {
  // Adiciona classe temporaria que esconde tudo menos o relatorio
  document.body.classList.add('printing');
  // Forca render com classes print-friendly
  const div = document.getElementById('rep-resultado');
  const original = div.innerHTML;
  div.innerHTML = `
    <div class="print-only-header">
      <h1>MLopes Finance — Balancete</h1>
      <p>Contexto: ${_contextoId} · Agrupamento: ${_ultimoRelatorio.agrupamento}</p>
      <p>Período atual: ${_ultimoRelatorio.atual.label}</p>
      ${_ultimoRelatorio.anterior ? `<p>Período anterior: ${_ultimoRelatorio.anterior.label}</p>` : ''}
    </div>
    ${original}
    <div class="print-only-footer">
      <p>Gerado em ${new Date().toLocaleString('pt-BR')} · MLopes Finance v0.7.0</p>
    </div>
  `;
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      div.innerHTML = original;
      document.body.classList.remove('printing');
    }, 500);
  }, 100);
}
