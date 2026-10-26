// MLopes Finance — Tela de Palavras-chave
// v0.12.7: User cadastra palavras (Uber, Vivo, 99) e o sistema busca em
// TODOS os lancamentos de despesa (substring case-insensitive em descricao).
// Mostra totais da semana/mes/ano e comparativo entre anos (grafico SVG).
//
// Layout:
// 1. Header com botao "Nova" + seletor de ano (comparativo)
// 2. Cards de totais (1 por palavra: semana, mes, ano)
// 3. Grafico de barras SVG comparando 2 anos
// 4. Lista de palavras com editar/excluir
// 5. Modal de edicao (CRUD simples)

const money = (c) => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const escapeHtml = (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function renderPalavrasChave(contextoId, api) {
  const app = document.getElementById('app');
  if (!app) return;
  const palavras = api('palavrasChave:listar', { contextoId });
  const hoje = new Date();
  const anoAtual = hoje.getUTCFullYear();
  // Comparativo default: ano atual vs anterior
  const comparativo = api('palavrasChave:comparativoAnual', { contextoId, anoA: anoAtual - 1, anoB: anoAtual });
  app.innerHTML = `
    <span class="eyebrow">BUSCA CONTROLADA</span>
    <h1>Palavras-chave</h1>
    <p class="subtitle">Cadastre palavras (Uber, Vivo, 99) pra monitorar seus gastos. O sistema busca em todos os lançamentos de despesa.</p>

    <div class="toolbar">
      <div class="toolbar-group">
        <button class="button" id="nova-palavra">+ Nova palavra-chave</button>
      </div>
      <div class="toolbar-group">
        <span class="muted">Comparar</span>
        <select id="cmp-ano-a" class="input-small">
          ${[anoAtual - 1, anoAtual - 2, anoAtual].map((a) => `<option value="${a}" ${a === comparativo.anoA ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
        <span class="muted">vs</span>
        <select id="cmp-ano-b" class="input-small">
          ${[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => `<option value="${a}" ${a === comparativo.anoB ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
        <button class="button ghost small" id="cmp-atualizar">Atualizar</button>
      </div>
    </div>

    ${palavras.length === 0
      ? `<div class="empty"><div class="icon">◌</div>Nenhuma palavra-chave cadastrada. Clique em "+ Nova palavra-chave" pra começar.</div>`
      : `
        <div class="cards-grid">
          ${palavras.map((p) => {
            const totais = api('palavrasChave:totais', { contextoId, palavra: p[2] });
            const meses12 = api('palavrasChave:ultimos12Meses', { contextoId, palavra: p[2] });
            return renderCardTotais(p, totais, meses12, contextoId, api);
          }).join('')}
        </div>
        ${renderGraficoSvg(comparativo)}
      `}

    ${palavras.length > 0 ? `
      <h3 style="margin-top: 24px;">Palavras cadastradas</h3>
      <div class="panel">
        <table>
          <thead>
            <tr><th>Nome</th><th>Criada em</th><th></th></tr>
          </thead>
          <tbody>
            ${palavras.map((p) => `
              <tr>
                <td><strong>${escapeHtml(p[2])}</strong></td>
                <td><small class="muted">${p[4] ? String(p[4]).slice(0, 10) : '—'}</small></td>
                <td>
                  <button class="button ghost small" data-editar="${p[0]}" data-nome="${escapeHtml(p[2])}">Editar</button>
                  <button class="button danger small" data-excluir="${p[0]}" data-nome="${escapeHtml(p[2])}">Excluir</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
  `;
  document.getElementById('nova-palavra').onclick = () => formPalavraChave(contextoId, api, null);
  document.querySelectorAll('button[data-editar]').forEach((btn) => {
    btn.onclick = () => formPalavraChave(contextoId, api, { id: Number(btn.dataset.editar), nome: btn.dataset.nome });
  });
  document.querySelectorAll('button[data-excluir]').forEach((btn) => {
    btn.onclick = () => {
      const id = Number(btn.dataset.excluir);
      const nome = btn.dataset.nome;
      if (!confirm(`Excluir "${nome}"?\n\n(Soft delete: a palavra fica inativa, nao sera usada em buscas. Use cascade pra apagar de verdade.)`)) return;
      try {
        api('palavrasChave:excluir', { id });
        if (globalThis.toastOk) toastOk(`"${nome}" excluida.`);
        renderPalavrasChave(contextoId, api);
      } catch (e) {
        if (globalThis.toastErr) toastErr('Erro: ' + e.message);
      }
    };
  });
  const cmpAtualizar = document.getElementById('cmp-atualizar');
  if (cmpAtualizar) {
    cmpAtualizar.onclick = () => {
      const anoA = Number(document.getElementById('cmp-ano-a').value);
      const anoB = Number(document.getElementById('cmp-ano-b').value);
      if (anoA === anoB) { if (globalThis.toastWarn) toastWarn('Escolha anos diferentes.'); return; }
      // Re-renderiza o gráfico no lugar (substitui o bloco .grafico-cmp)
      const appEl = document.getElementById('app');
      const cmp = api('palavrasChave:comparativoAnual', { contextoId, anoA, anoB });
      const pal = api('palavrasChave:listar', { contextoId });
      const novoGrafico = appEl.querySelector('.grafico-cmp');
      if (novoGrafico) {
        const tmp = document.createElement('div');
        tmp.innerHTML = renderGraficoSvg(cmp);
        novoGrafico.replaceWith(tmp.firstElementChild);
      }
    };
  }
  // v0.13.0: toggle de cada card pra mostrar/ocultar lancamentos individuais
  document.querySelectorAll('button[data-toggle-lancamentos]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.toggleLancamentos;
      const painel = document.getElementById(`lancamentos-painel-${id}`);
      if (!painel) return;
      const aberto = painel.style.display !== 'none';
      painel.style.display = aberto ? 'none' : 'block';
      btn.textContent = aberto
        ? btn.textContent.replace('Ocultar', 'Ver').replace('Ver', 'Ver')
        : btn.textContent.replace('Ver', 'Ocultar');
    };
  });
}

function renderCardTotais(palavraRow, totais, meses12, contextoId, api) {
  // p shape: [id, contextoId, nome, ativo, criadoEm]
  const [id, , nome] = palavraRow;
  // Sparkline 12 meses: max do array pra escalar
  const max = Math.max(1, ...meses12.map((m) => m.totalCentavos));
  const sparkline = `
    <div class="sparkline">
      ${meses12.map((m) => {
        const h = Math.max(2, Math.round((m.totalCentavos / max) * 32));
        return `<div class="sparkline-bar ${m.isMesCorrente ? 'corrente' : ''} ${m.totalCentavos === 0 ? 'vazio' : ''}" style="height: ${h}px;" title="${m.mes}: ${money(m.totalCentavos)}"></div>`;
      }).join('')}
    </div>
    <div class="sparkline-labels">
      ${meses12.map((m) => `<span class="${m.isMesCorrente ? 'corrente' : ''}">${m.mes.slice(5)}/${m.mes.slice(2, 4)}</span>`).join('')}
    </div>
  `;
  // v0.13.0: carregar lancamentos individuais (ultimos 100, ordenados desc)
  const lancamentos = api('palavrasChave:buscar', { contextoId, palavra: nome, limite: 100 });
  const lancamentosHtml = lancamentos.length === 0
    ? '<div class="empty-mini">Nenhum lançamento encontrado.</div>'
    : `
      <div class="lancamentos-wrap" style="max-height: 320px; overflow-y: auto;">
        <table class="tabela-lancamentos">
          <thead>
            <tr><th>Data</th><th>Descrição</th><th style="text-align:right;">Valor</th><th>Conta</th></tr>
          </thead>
          <tbody>
            ${lancamentos.map((l) => {
              const [lid, , contaId, , , valor, data, , desc] = l;
              // Resolve nome da conta
              const contas = api('contas:listar', { contextoId });
              const contaRow = contas.find((c) => c[0] === contaId);
              const contaNome = contaRow ? String(contaRow[2]) : '—';
              return `<tr>
                <td>${fmtDataCurta(data)}</td>
                <td>${escapeHtml(desc)}</td>
                <td style="text-align:right;">${money(valor)}</td>
                <td>${escapeHtml(contaNome)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${lancamentos.length === 100 ? '<div class="muted small">Mostrando os 100 mais recentes.</div>' : ''}
    `;
  return `
    <div class="card card-totais-palavra">
      <span class="card-label">${escapeHtml(nome)}</span>
      <div class="card-totais-grid">
        <div class="card-totais-cell">
          <span class="card-totais-label">Esta semana</span>
          <span class="card-totais-value">${money(totais.totalSemanaCentavos)}</span>
          <span class="card-totais-periodo">${totais.periodoSemana?.inicio || '—'} a ${totais.periodoSemana?.fim || '—'}</span>
        </div>
        <div class="card-totais-cell">
          <span class="card-totais-label">Este mês</span>
          <span class="card-totais-value">${money(totais.totalMesCentavos)}</span>
          <span class="card-totais-periodo">${totais.periodoMes || '—'}</span>
        </div>
        <div class="card-totais-cell">
          <span class="card-totais-label">Este ano</span>
          <span class="card-totais-value">${money(totais.totalAnoCentavos)}</span>
          <span class="card-totais-periodo">${totais.periodoAno || '—'}</span>
        </div>
      </div>
      <div class="card-sparkline">
        <span class="sparkline-titulo">Últimos 12 meses</span>
        ${sparkline}
      </div>
      <span class="card-sub">${totais.qtdLancamentos} lançamento(s) com essa palavra</span>
      <div class="card-lancamentos-toggle">
        <button type="button" class="button ghost small" data-toggle-lancamentos="${id}">📋 Ver lançamentos individuais (${lancamentos.length})</button>
      </div>
      <div class="card-lancamentos-painel" id="lancamentos-painel-${id}" style="display: none;">
        ${lancamentosHtml}
      </div>
    </div>
  `;
}

const fmtDataCurta = (iso) => {
  if (!iso || typeof iso !== 'string' || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

function renderGraficoSvg(cmp) {
  if (!cmp.palavras.length) return '';
  // v0.12.8: trocou SVG por HTML puro (CSS bar chart) pra evitar clipping do WebView2.
  // Cada palavra ocupa 1 linha com 2 barras (ano A cinza + ano B brand).
  const max = Math.max(1, ...cmp.palavras.flatMap((p) => [p.totalAnoACentavos, p.totalAnoBCentavos]));
  const linhas = cmp.palavras.map((p) => {
    const wA = Math.max(0.5, (p.totalAnoACentavos / max) * 100);
    const wB = Math.max(0.5, (p.totalAnoBCentavos / max) * 100);
    const variacaoClasse = p.variacaoPercentual == null ? 'novo' : (p.variacaoPercentual > 0 ? 'up' : (p.variacaoPercentual < 0 ? 'down' : 'mesmo'));
    const variacaoLabel = p.variacaoPercentual == null ? 'novo' : (p.variacaoPercentual > 0 ? `▲ +${p.variacaoPercentual}%` : (p.variacaoPercentual < 0 ? `▼ ${p.variacaoPercentual}%` : '= 0%'));
    return `
      <div class="grafico-linha">
        <div class="grafico-nome">${escapeHtml(p.nome)}</div>
        <div class="grafico-barras-area">
          <div class="grafico-barra">
            <span class="grafico-barra-label">${cmp.anoA}</span>
            <div class="grafico-barra-track"><div class="grafico-barra-fill ano-a" style="width: ${wA}%;"></div></div>
            <span class="grafico-barra-valor">${money(p.totalAnoACentavos)}</span>
          </div>
          <div class="grafico-barra">
            <span class="grafico-barra-label">${cmp.anoB}</span>
            <div class="grafico-barra-track"><div class="grafico-barra-fill ano-b" style="width: ${wB}%;"></div></div>
            <span class="grafico-barra-valor"><strong>${money(p.totalAnoBCentavos)}</strong></span>
          </div>
        </div>
        <div class="grafico-variacao ${variacaoClasse}">${variacaoLabel}</div>
      </div>
    `;
  }).join('');
  return `
    <div class="panel grafico-cmp">
      <h3>📊 Comparativo anual: ${cmp.anoA} vs ${cmp.anoB}</h3>
      <p class="subtitle">Total gasto em cada palavra-chave por ano. Variação: ▲ vermelho = subiu, ▼ verde = desceu, = cinza = igual.</p>
      <div class="grafico-barras">${linhas}</div>
    </div>
  `;
}

function formPalavraChave(contextoId, api, item) {
  const app = document.getElementById('app');
  const v = item?.nome ?? '';
  app.innerHTML = `
    <div class="panel">
      <h1>${item ? 'Editar' : 'Nova'} palavra-chave</h1>
      <p class="subtitle">Palavra que será buscada em todos os lançamentos de despesa (substring, sem acentos).</p>
      <form id="form-palavra">
        <div class="form-grid">
          <label>Nome *
            <input name="nome" required minlength="2" maxlength="50" value="${escapeHtml(v)}" placeholder="Ex: Uber, Vivo, 99, Adobe, iFood">
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" id="cancelar">Cancelar</button>
          <button class="button">${item ? 'Salvar' : 'Criar'}</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('cancelar').onclick = () => renderPalavrasChave(contextoId, api);
  document.getElementById('form-palavra').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const dados = { nome: f.get('nome') };
    try {
      if (item) { api('palavrasChave:atualizar', { id: item.id, ...dados }); }
      else { api('palavrasChave:criar', { contextoId, ...dados }); }
      if (globalThis.toastOk) toastOk(item ? 'Palavra-chave atualizada.' : 'Palavra-chave criada.');
      renderPalavrasChave(contextoId, api);
    } catch (err) {
      if (globalThis.toastErr) toastErr('Erro: ' + err.message);
    }
  };
}
