// MLopes Finance — Tela de Gastos Recorrentes
// v0.12.3: detecta padroes (Uber, 99, Adobe, Netflix, etc) nos lancamentos existentes
// e mostra relatorios mensais e anuais. Heuristica: mesmo valor + nome normalizado
// + periodicidade calculada (mensal, semanal, etc).
//
// Layout:
// 1. Header com acoes (Detectar, Relatorio mensal, Relatorio anual)
// 2. Aba "Detectados" (padrao): lista de recorrentes confirmados + modal de deteccao
// 3. Aba "Relatorio mensal": 12 meses, estimado vs real
// 4. Aba "Relatorio anual": top 10 + comparativo YoY

const PERIODICIDADE_LABEL = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  irregular: 'Irregular',
};

const PERIODICIDADE_ICONE = {
  semanal: '🗓', quinzenal: '🗓', mensal: '📅', bimestral: '📅',
  trimestral: '📅', semestral: '📆', anual: '🎂', irregular: '?',
};

// Reusa os helpers do app.js: money, fmtData, fmtMes. Se nao existirem localmente,
// cai em fallback (modulo ES nao compartilha escopo).
const money = (c) => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso) => {
  if (!iso || typeof iso !== 'string' || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const fmtMes = (iso) => {
  if (!iso || typeof iso !== 'string' || !iso.includes('-')) return iso || '';
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
};
const escapeHtml = (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function renderRecorrencias(contextoId, api) {
  const app = document.getElementById('app');
  if (!app) return;
  const gastos = api('gastosRecorrentes:listar', { contextoId });
  app.innerHTML = `
    <span class="eyebrow">DETECÇÃO AUTOMÁTICA</span>
    <h1>Gastos recorrentes</h1>
    <p class="subtitle">Detecta padrões (Uber, 99, Adobe, etc) nos lançamentos e projeta os próximos 12 meses.</p>

    <div class="toolbar">
      <div class="toolbar-group">
        <button class="button" id="detectar">🔍 Detectar recorrências</button>
        <button class="button ghost" id="rel-mensal">📊 Relatório mensal</button>
        <button class="button ghost" id="rel-anual">📈 Relatório anual</button>
        <button class="button ghost" id="rel-categoria">📂 Por categoria</button>
      </div>
    </div>

    <div id="recorrencias-conteudo">
      ${renderBlocoLista(gastos)}
    </div>
  `;
  document.getElementById('detectar').onclick = () => abrirModalDeteccao(contextoId, api);
  document.getElementById('rel-mensal').onclick = () => abrirRelatorioMensal(contextoId, api);
  document.getElementById('rel-anual').onclick = () => abrirRelatorioAnual(contextoId, api);
  document.getElementById('rel-categoria').onclick = () => abrirRelatorioCategoria(contextoId, api);
  document.querySelectorAll('button[data-excluir-recorrente]').forEach((btn) => {
    btn.onclick = () => {
      const id = Number(btn.dataset.excluirRecorrente);
      const nome = btn.dataset.nome;
      if (!confirm(`Excluir "${nome}"?\n\nOs lancamentos vinculados NAO serao apagados (apenas o vinculo).`)) return;
      try {
        api('gastosRecorrentes:excluir', { id });
        if (globalThis.toastOk) toastOk(`"${nome}" excluido.`);
        renderRecorrencias(contextoId, api);
      } catch (e) {
        if (globalThis.toastErr) toastErr('Erro: ' + e.message);
      }
    };
  });
}

function renderBlocoLista(gastos) {
  if (!gastos.length) {
    return `<div class="empty"><div class="icon">◌</div>Nenhum gasto recorrente detectado. Clique em "Detectar recorrências" para varrer os lançamentos.</div>`;
  }
  const totalMes = gastos.filter((g) => g.periodicidade === 'mensal').reduce((s, g) => s + g.valor_centavos, 0);
  return `
    <div class="cards">
      <div class="card"><span class="card-label">Recorrentes confirmados</span><span class="card-value">${gastos.length}</span><span class="card-sub">padrões detectados</span></div>
      <div class="card"><span class="card-label">Total mensal</span><span class="card-value">${money(totalMes)}</span><span class="card-sub">só mensal</span></div>
    </div>
    <div class="panel">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Valor</th>
            <th>Periodicidade</th>
            <th>Ocorrências</th>
            <th>Última vez</th>
            <th>Categoria sugerida</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${gastos.map((g) => `
            <tr>
              <td><strong>${escapeHtml(g.nome_exibicao)}</strong><br><small class="muted">${escapeHtml(g.nome_normalizado)}</small></td>
              <td>${money(g.valor_centavos)}</td>
              <td>${PERIODICIDADE_ICONE[g.periodicidade] || ''} ${PERIODICIDADE_LABEL[g.periodicidade] || g.periodicidade}</td>
              <td>${g.ocorrencias}x<br><small class="muted">${g.qtd_lancamentos_vinculados} vinc.</small></td>
              <td>${fmtData(g.data_ultima)}</td>
              <td>${escapeHtml(g.categoria_sugerida || '—')}</td>
              <td><button class="button danger small" data-excluir-recorrente="${g.id}" data-nome="${escapeHtml(g.nome_exibicao)}">Excluir</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function abrirModalDeteccao(contextoId, api) {
  const app = document.getElementById('app');
  // Roda a deteccao
  const candidatos = api('gastosRecorrentes:detectar', { contextoId, minOcorrencias: 2 });
  if (!candidatos.length) {
    if (globalThis.toastWarn) toastWarn('Nenhum padrao detectado (minimo 2 ocorrencias com mesmo valor e nome similar).');
    return;
  }
  app.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width: 720px;">
        <h2>🔍 ${candidatos.length} candidato(s) detectado(s)</h2>
        <p class="subtitle">Marque os padrões que você quer confirmar como recorrentes. Lançamento agrupado por valor + nome normalizado.</p>
        <div class="toolbar" style="margin: 8px 0; padding: 8px 0;">
          <div class="toolbar-group">
            <button type="button" class="button ghost small" id="selecionar-todos">☑ Selecionar todos</button>
            <button type="button" class="button ghost small" id="desmarcar-todos">☐ Desmarcar todos</button>
            <button type="button" class="button ghost small" id="inverter-selecao">⇄ Inverter</button>
          </div>
          <div class="toolbar-group">
            <span class="muted" id="contador-selecionados">0 de ${candidatos.length} selecionados</span>
          </div>
        </div>
        <div class="panel" style="max-height: 50vh; overflow-y: auto;">
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" id="check-todos-header" title="Selecionar/Desmarcar todos"></th>
                <th>Nome</th>
                <th>Valor</th>
                <th>Periodicidade</th>
                <th>Ocorrências</th>
                <th>Categoria sugerida</th>
              </tr>
            </thead>
            <tbody>
              ${candidatos.map((c, i) => `
                <tr>
                  <td><input type="checkbox" data-check-candidato="${i}" ${c.ocorrencias >= 3 ? 'checked' : ''}></td>
                  <td><strong>${escapeHtml(c.nomeExibicao)}</strong><br><small class="muted">${escapeHtml(c.nomeNormalizado)}</small></td>
                  <td>${money(c.valorCentavos)}</td>
                  <td>${PERIODICIDADE_LABEL[c.periodicidade] || c.periodicidade} <small class="muted">(${c.intervaloMedioDias}d)</small></td>
                  <td>${c.ocorrencias}x</td>
                  <td>${escapeHtml(c.categoriaSugerida || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" id="cancelar-deteccao">Cancelar</button>
          <button class="button" id="confirmar-deteccao">Confirmar selecionados</button>
        </div>
      </div>
    </div>
  `;
  // v0.12.6: helpers de selecao em massa + contador em tempo real
  const checks = () => document.querySelectorAll('input[data-check-candidato]');
  const contador = document.getElementById('contador-selecionados');
  const atualizarContador = () => {
    const total = checks().length;
    const marcados = [...checks()].filter((c) => c.checked).length;
    if (contador) contador.textContent = `${marcados} de ${total} selecionados`;
    const header = document.getElementById('check-todos-header');
    if (header) header.checked = (marcados === total);
  };
  document.getElementById('selecionar-todos').onclick = () => {
    checks().forEach((c) => { c.checked = true; });
    atualizarContador();
  };
  document.getElementById('desmarcar-todos').onclick = () => {
    checks().forEach((c) => { c.checked = false; });
    atualizarContador();
  };
  document.getElementById('inverter-selecao').onclick = () => {
    checks().forEach((c) => { c.checked = !c.checked; });
    atualizarContador();
  };
  document.getElementById('check-todos-header').onchange = (e) => {
    checks().forEach((c) => { c.checked = e.target.checked; });
    atualizarContador();
  };
  checks().forEach((c) => { c.onchange = atualizarContador; });
  atualizarContador();
  document.getElementById('cancelar-deteccao').onclick = () => renderRecorrencias(contextoId, api);
  document.getElementById('confirmar-deteccao').onclick = () => {
    const checksEl = document.querySelectorAll('input[data-check-candidato]');
    const selecionados = [];
    checksEl.forEach((c) => {
      if (c.checked) {
        const idx = Number(c.dataset.checkCandidato);
        selecionados.push(candidatos[idx]);
      }
    });
    if (!selecionados.length) {
      if (globalThis.toastWarn) toastWarn('Nenhum candidato selecionado.');
      return;
    }
    try {
      const r = api('gastosRecorrentes:salvar', { contextoId, candidatos: selecionados });
      if (globalThis.toastOk) toastOk(`${r.salvos} gasto(s) recorrente(s) confirmado(s).`);
      renderRecorrencias(contextoId, api);
    } catch (e) {
      if (globalThis.toastErr) toastErr('Erro: ' + e.message);
    }
  };
}

function abrirRelatorioMensal(contextoId, api) {
  const app = document.getElementById('app');
  const relatorio = api('gastosRecorrentes:relatorioMensal', { contextoId });
  const totalEstimado = relatorio.reduce((s, m) => s + m.totalEstimadoCentavos, 0);
  const totalReal = relatorio.reduce((s, m) => s + m.totalRealCentavos, 0);
  app.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width: 900px;">
        <h2>📊 Relatório mensal — próximos 12 meses</h2>
        <p class="subtitle">Projeção de gastos recorrentes confirmados (estimado) vs o que realmente caiu no mês (real).</p>
        <div class="cards">
          <div class="card"><span class="card-label">Total estimado (12m)</span><span class="card-value">${money(totalEstimado)}</span></div>
          <div class="card"><span class="card-label">Total real (12m)</span><span class="card-value">${money(totalReal)}</span></div>
          <div class="card"><span class="card-label">Diferença</span><span class="card-value ${totalEstimado > totalReal ? 'positive' : 'negative'}">${money(totalEstimado - totalReal)}</span></div>
        </div>
        <div class="panel" style="max-height: 60vh; overflow-y: auto;">
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Estimado</th>
                <th>Real</th>
                <th>Diferença</th>
                <th>Qtd</th>
              </tr>
            </thead>
            <tbody>
              ${relatorio.map((m) => {
                const diff = m.totalEstimadoCentavos - m.totalRealCentavos;
                const classe = diff > 0 ? 'positive' : (diff < 0 ? 'negative' : '');
                return `<tr>
                  <td><strong>${fmtMes(m.mes)}</strong></td>
                  <td>${money(m.totalEstimadoCentavos)}</td>
                  <td>${money(m.totalRealCentavos)}</td>
                  <td class="${classe}">${money(diff)}</td>
                  <td>${m.qtdGastos}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="form-actions">
          <button class="button secondary" id="voltar-lista">Voltar</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('voltar-lista').onclick = () => renderRecorrencias(contextoId, api);
}

function abrirRelatorioAnual(contextoId, api) {
  const app = document.getElementById('app');
  const rel = api('gastosRecorrentes:relatorioAnual', { contextoId });
  if (!rel) {
    if (globalThis.toastWarn) toastWarn('Sem dados para gerar o relatório anual.');
    return;
  }
  const variacaoLabel = rel.variacaoPercentual == null ? '—' : (rel.variacaoPercentual > 0 ? `+${rel.variacaoPercentual}%` : `${rel.variacaoPercentual}%`);
  const variacaoClasse = rel.variacaoPercentual == null ? '' : (rel.variacaoPercentual > 0 ? 'negative' : 'positive');
  app.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width: 900px;">
        <h2>📈 Relatório anual — ${rel.ano}</h2>
        <p class="subtitle">Top 10 gastos recorrentes no ano, comparativo com ${rel.anoAnterior} e visão por periodicidade.</p>
        <div class="cards">
          <div class="card"><span class="card-label">Total no ano</span><span class="card-value">${money(rel.totalCentavos)}</span></div>
          <div class="card"><span class="card-label">Total em ${rel.anoAnterior}</span><span class="card-value">${money(rel.totalAnoAnteriorCentavos)}</span></div>
          <div class="card"><span class="card-label">Variação YoY</span><span class="card-value ${variacaoClasse}">${variacaoLabel}</span></div>
        </div>
        <h3>Top 10 do ano</h3>
        <div class="panel" style="max-height: 40vh; overflow-y: auto;">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nome</th>
                <th>Valor unitário</th>
                <th>Periodicidade</th>
                <th>Ocorrências</th>
                <th>Total no ano</th>
              </tr>
            </thead>
            <tbody>
              ${rel.ranking.map((r, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${escapeHtml(r.nome)}</strong>${r.categoriaSugerida ? `<br><small class="muted">${escapeHtml(r.categoriaSugerida)}</small>` : ''}</td>
                  <td>${money(r.valorUnitarioCentavos)}</td>
                  <td>${PERIODICIDADE_LABEL[r.periodicidade] || r.periodicidade}</td>
                  <td>${r.ocorrencias}x</td>
                  <td><strong>${money(r.totalCentavos)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <h3>Por periodicidade</h3>
        <div class="panel">
          <table>
            <thead>
              <tr><th>Periodicidade</th><th>Qtd de gastos</th><th>Total no ano</th></tr>
            </thead>
            <tbody>
              ${rel.porPeriodicidade.map((p) => `
                <tr>
                  <td>${PERIODICIDADE_LABEL[p.periodicidade] || p.periodicidade}</td>
                  <td>${p.qtd}</td>
                  <td><strong>${money(p.totalCentavos)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="form-actions">
          <button class="button secondary" id="voltar-lista">Voltar</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('voltar-lista').onclick = () => renderRecorrencias(contextoId, api);
}
