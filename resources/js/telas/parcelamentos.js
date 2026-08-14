// MLopes Finance — Tela de Parcelamentos (v0.11.0)
// Compra em Nx (ex: iPhone 12x R$ 250) → N parcelas automaticas, cada uma
// vinculada a uma fatura especifica do cartao. UI mostra:
// - 3 grupos: Ativos (com pendentes) / Pausados / Quitados
// - Drill-down de cada parcelamento com datas (vencimento + pagaEm) + resumo
// - Calendario MÊS A MÊS COMPLETO ate findar a ULTIMA parcela (range dinamico)
// - Form de cadastro

let _contextoId = null;
let _api = null;

export function renderParcelamentos(contextoId, api) {
  _contextoId = contextoId;
  _api = api;

  const cartoes = api('cartoes:listar', { contextoId });
  const categorias = api('categorias:listar', { contextoId }).filter(c => c[3] === 'despesa' || c[3] === 'ambas');
  const contas = api('contas:listar', { contextoId }).filter(c => c[3] === 'bancaria');
  // v0.11.0: lista TODOS os parcelamentos (inclui inativos e quitados),
  // e a UI separa visualmente em 3 grupos: ativos (com pendentes), pausados, quitados
  const listaCompleta = api('parcelamentos:listar', { contextoId, incluirInativos: true });
  // Agrupa: ativos (com pendentes) / pausados (sem parcelas pagas e ativo=0) / quitados (todas pagas)
  const ativos = listaCompleta.filter(p => p.ativo && p.parcelasPagas < p.numParcelas);
  const pausados = listaCompleta.filter(p => !p.ativo && p.parcelasPagas < p.numParcelas);
  const quitados = listaCompleta.filter(p => p.parcelasPagas === p.numParcelas);

  const app = document.getElementById('app');
  // v0.11.0: calendario COMPLETO (range dinamico ate a ULTIMA parcela, nao fixo em 12)
  const calendario = _api('parcelamentos:calendarioCompleto', { contextoId, mesesMinimos: 6 });
  // Totalizadores adicionais para os cards do topo
  const totalPagoGeral = listaCompleta.reduce((s, p) => s + p.valorPagoCentavos, 0);
  const totalAbertoGeral = listaCompleta.reduce((s, p) => s + (p.valorTotalCentavos - p.valorPagoCentavos), 0);
  const totalQuitadoGeral = quitados.reduce((s, p) => s + p.valorTotalCentavos, 0);
  // Ultima parcela a vencer (de TODOS os parcelamentos, ativos e quitados)
  const ultimaParcelaMes = calendario.length > 0 ? calendario[calendario.length - 1].mes : null;
  // v0.11.1: conta quantos parcelados foram detectados no extrato mas ainda nao tem parcelamento
  let qtdDetectadosExtrato = 0;
  for (const c of cartoes) {
    const det = _api('parcelamentos:detectarDoExtrato', { contextoId, cartaoId: c[0] });
    qtdDetectadosExtrato += det.length;
  }

  app.innerHTML = `
    <span class="eyebrow">FASE 7</span>
    <h1>Parcelamentos <em>(compras em Nx)</em></h1>
    <p class="subtitle">Compra em N vezes gera N parcelas automáticas vinculadas à fatura do cartão. Acompanhe o progresso, veja parcelas pendentes + quitadas, e projete mês a mês até a última parcela.</p>

    <div class="cards">
      <div class="card">
        <span class="card-label">Ativos (com parcelas pendentes)</span>
        <span class="card-value">${ativos.length}</span>
        <span class="card-sub">${pausados.length} pausado(s) · ${quitados.length} quitado(s)</span>
      </div>
      <div class="card">
        <span class="card-label">A pagar (total)</span>
        <span class="card-value" style="color: var(--negative);">${money(totalAbertoGeral)}</span>
        <span class="card-sub">em parcelamentos ativos</span>
      </div>
      <div class="card">
        <span class="card-label">Já pago (total)</span>
        <span class="card-value" style="color: var(--positive);">${money(totalPagoGeral)}</span>
        <span class="card-sub">em todos os parcelamentos</span>
      </div>
      <div class="card">
        <span class="card-label">Já quitado (total)</span>
        <span class="card-value" style="font-size:18px; color: var(--positive);">${money(totalQuitadoGeral)}</span>
        <span class="card-sub">${quitados.length} compra(s) finalizadas</span>
      </div>
    </div>

    <div class="panel">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h2>📦 Ativos (${ativos.length})</h2>
        <div>
          ${qtdDetectadosExtrato > 0 ? `<button class="button ghost" id="parcelamento-detectar-extrato" title="Encontrei ${qtdDetectadosExtrato} compra(s) parcelada(s) no extrato que ainda nao virou parcelamento">🔍 Detectar parcelados do extrato (${qtdDetectadosExtrato})</button> ` : ''}
          <button class="button" id="parcelamento-novo">+ Novo parcelamento</button>
        </div>
      </div>
      ${ativos.length === 0 ? '<div class="empty">Nenhum parcelamento ativo. Clique "+ Novo parcelamento" pra cadastrar uma compra parcelada (ex: iPhone 12x R$ 250).</div>' : `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr><th>Descrição</th><th>Cartão</th><th>Categoria</th><th style="text-align:right;">Valor total</th><th>Progresso</th><th style="text-align:right;">Valor pago</th><th>Próxima</th><th>Status</th><th style="text-align:right;">Ações</th></tr>
          </thead>
          <tbody>
            ${ativos.map(p => renderLinhaParcelamento(p, 'ativo')).join('')}
          </tbody>
        </table>
      </div>
      `}
    </div>

    ${pausados.length > 0 ? `
    <div class="panel">
      <h2>⏸ Pausados (${pausados.length})</h2>
      <p class="subtitle">Parcelamentos desativados. Para retomar, edite e marque como ativo (em breve).</p>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr><th>Descrição</th><th>Cartão</th><th>Categoria</th><th style="text-align:right;">Valor total</th><th>Progresso</th><th>Status</th><th style="text-align:right;">Ações</th></tr>
          </thead>
          <tbody>
            ${pausados.map(p => renderLinhaParcelamento(p, 'pausado')).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <div class="panel">
      <h2>✅ Quitados (${quitados.length})</h2>
      <p class="subtitle">Todos os parcelamentos que terminaram (última parcela paga). Mantidos pra histórico.</p>
      ${quitados.length === 0 ? '<div class="empty">Nenhum parcelamento quitado ainda.</div>' : `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr><th>Descrição</th><th>Cartão</th><th>Categoria</th><th style="text-align:right;">Parcela</th><th style="text-align:right;">Valor total</th><th>Início</th><th>Quitado em</th><th style="text-align:right;">Ações</th></tr>
          </thead>
          <tbody>
            ${(() => {
              // v0.11.0: pra cada quitado, busca info detalhada (dataQuitacao, primeiroVencimento)
              return quitados.map(p => {
                const detalhe = _api('parcelamentos:obterCompleto', { parcelamentoId: p.id });
                const dq = detalhe?.resumo?.dataQuitacao;
                const d1 = detalhe?.resumo?.primeiroVencimento;
                const valorParcela = p.valorTotalCentavos / p.numParcelas;
                return `
                  <tr style="opacity: 0.85;">
                    <td><strong>${escapeHtml(p.descricao)}</strong></td>
                    <td>${escapeHtml(p.cartaoNome)}</td>
                    <td>${p.categoriaNome ? escapeHtml(p.categoriaNome) : '<span class="muted">—</span>'}</td>
                    <td style="text-align:right;">${p.numParcelas}x ${money(valorParcela)}</td>
                    <td style="text-align:right;">${money(p.valorTotalCentavos)}</td>
                    <td>${d1 ? fmtData(d1) : '<span class="muted">—</span>'}</td>
                    <td>${dq ? `<span class="pill" style="color:var(--positive);">${fmtData(dq)}</span>` : '<span class="muted">ver detalhe</span>'}</td>
                    <td style="text-align:right;">
                      <button class="button ghost small parcelamento-ver" data-id="${p.id}">Ver histórico</button>
                      <button class="button ghost small danger parcelamento-excluir" data-id="${p.id}" data-desc="${escapeHtml(p.descricao)}">Excluir</button>
                    </td>
                  </tr>
                `;
              }).join('');
            })()}
          </tbody>
        </table>
      </div>
      `}
    </div>

    <div class="panel">
      <h2>📊 Resumo mês a mês completo até quitar</h2>
      <p class="subtitle">
        Calendário de TODAS as parcelas (ativas + quitadas) agrupadas por mês, do mês atual até o mês da <strong>última parcela</strong>${ultimaParcelaMes ? ` (<strong>${fmtMes(ultimaParcelaMes)}</strong>)` : ''}.
        Pra cada mês: total a pagar, total já pago, e quais parcelas vencem. Clica numa parcela pra ver o detalhe.
      </p>
      ${calendario.every(m => m.qtdParcelas === 0) ? '<div class="empty">Nenhuma parcela cadastrada ainda.</div>' : `
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px;">
        ${calendario.map(m => {
          const isFuturo = m.mes >= new Date().toISOString().slice(0, 7);
          const corBorda = m.totalPendentesCentavos > 0
            ? (isFuturo ? 'var(--brand)' : 'var(--negative)')
            : 'var(--positive)';
          return `
            <div class="card" style="padding:14px; border-left: 3px solid ${corBorda};">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
                <span class="card-label" style="margin:0;">${fmtMes(m.mes)}</span>
                ${m.qtdParcelas > 0 ? `<span style="font-size:11px; color:var(--muted);">${m.qtdParcelas} parcela(s)</span>` : ''}
              </div>
              ${m.qtdParcelas === 0 ? `
                <div style="font-size:13px; color:var(--muted); padding: 4px 0;">— sem parcelas —</div>
              ` : `
                <div style="font-size:11px; color:var(--muted); margin-bottom:4px;">
                  ${m.totalPagasCentavos > 0 ? `<span style="color:var(--positive);">${money(m.totalPagasCentavos)} pago</span> · ` : ''}
                  <span style="color:var(--negative); font-weight:600;">${money(m.totalPendentesCentavos)} pendente</span>
                </div>
                <div style="font-size:11px; color:var(--muted); margin-bottom:6px;">Total mês: <strong>${money(m.totalCentavos)}</strong></div>
                <div style="font-size:11px; line-height:1.5; max-height: 100px; overflow-y:auto;">
                  ${m.parcelas.map(p => {
                    const isPaga = p.status === 'paga';
                    return `
                      <div style="display:flex; justify-content:space-between; gap:6px; padding:2px 0;">
                        <span style="${isPaga ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHtml(p.descricao.slice(0, 18))}${p.descricao.length > 18 ? '…' : ''} <span style="color:var(--muted);">${p.parcelaNumero}/${p.totalParcelas}</span></span>
                        <span style="${isPaga ? 'color:var(--positive); opacity:0.6;' : 'color:var(--negative);'} white-space:nowrap;">${money(p.valorCentavos)}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          `;
        }).join('')}
      </div>
      `}
    </div>

    <div id="parcelamento-form-container" style="display:none;"></div>
    <div id="parcelamento-detalhes-container" style="display:none;"></div>
  `;

  document.getElementById('parcelamento-novo').onclick = () => formParcelamento(null, cartoes, categorias, contas);
  const btnDetectar = document.getElementById('parcelamento-detectar-extrato');
  if (btnDetectar) btnDetectar.onclick = () => abrirModalDeteccao(cartoes);
  document.querySelectorAll('button.parcelamento-ver').forEach(btn => {
    btn.onclick = () => verParcelas(Number(btn.dataset.id), listaCompleta);
  });
  document.querySelectorAll('button.parcelamento-excluir').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      const desc = btn.dataset.desc;
      if (!confirm(`Excluir o parcelamento "${desc}"?\n\nPor padrão BLOQUEIA se tem parcelas pagas (preserva histórico). Com CASCADE: apaga o parcelamento + todas as parcelas + desvincula os lançamentos.`)) return;
      try {
        const r = _api('parcelamentos:excluir', { parcelamentoId: id });
        if (!r.ok) {
          if (confirm(`${r.mensagem}\n\nExcluir com CASCADE?`)) {
            _api('parcelamentos:excluir', { parcelamentoId: id, cascade: true });
            if (globalThis.toastOk) toastOk('Parcelamento excluído em cascata.');
          }
        } else {
          if (globalThis.toastOk) toastOk(r.cascade ? 'Parcelamento excluído em cascata.' : 'Parcelamento pausado/desativado.');
        }
        renderParcelamentos(_contextoId, _api);
      } catch (err) {
        if (globalThis.toastErr) toastErr('Erro: ' + err.message);
      }
    };
  });
}

function renderLinhaParcelamento(p, modo) {
  // Modo: 'ativo' | 'pausado' (renderiza colunas diferentes)
  const pagoPct = Math.round((p.parcelasPagas / p.numParcelas) * 100);
  const statusLabel = !p.ativo
    ? '<span class="pill warn">Pausado</span>'
    : pagoPct === 100
      ? '<span class="pill" style="color:var(--positive);">✓ Quitado</span>'
      : '<span class="pill is-static">Ativo</span>';
  const acoes = `
    <button class="button ghost small parcelamento-ver" data-id="${p.id}">Ver parcelas</button>
    <button class="button ghost small danger parcelamento-excluir" data-id="${p.id}" data-desc="${escapeHtml(p.descricao)}">Excluir</button>
  `;
  if (modo === 'pausado') {
    return `
      <tr style="opacity: 0.7;">
        <td><strong>${escapeHtml(p.descricao)}</strong></td>
        <td>${escapeHtml(p.cartaoNome)}</td>
        <td>${p.categoriaNome ? escapeHtml(p.categoriaNome) : '<span class="muted">—</span>'}</td>
        <td style="text-align:right;">${money(p.valorTotalCentavos)}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="cartao-progress" style="flex:1; min-width:60px;">
              <div class="cartao-progress-bar" style="width:${pagoPct}%; background:var(--muted);"></div>
            </div>
            <span style="font-size:12px; color:var(--muted); white-space:nowrap;">${p.parcelasPagas}/${p.numParcelas}</span>
          </div>
        </td>
        <td>${statusLabel}</td>
        <td style="text-align:right;">${acoes}</td>
      </tr>
    `;
  }
  return `
    <tr>
      <td><strong>${escapeHtml(p.descricao)}</strong></td>
      <td>${escapeHtml(p.cartaoNome)}</td>
      <td>${p.categoriaNome ? escapeHtml(p.categoriaNome) : '<span class="muted">—</span>'}</td>
      <td style="text-align:right;">${money(p.valorTotalCentavos)}</td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="cartao-progress" style="flex:1; min-width:60px;">
            <div class="cartao-progress-bar" style="width:${pagoPct}%; background:${pagoPct === 100 ? 'var(--positive)' : 'var(--brand)'};"></div>
          </div>
          <span style="font-size:12px; color:var(--muted); white-space:nowrap;">${p.parcelasPagas}/${p.numParcelas}</span>
        </div>
      </td>
      <td style="text-align:right;">${money(p.valorPagoCentavos)}</td>
      <td>${p.proximaParcela ? fmtData(p.proximaParcela) : '—'}</td>
      <td>${statusLabel}</td>
      <td style="text-align:right;">${acoes}</td>
    </tr>
  `;
}

function verParcelas(parcelamentoId, lista) {
  const container = document.getElementById('parcelamento-detalhes-container');
  const p = lista.find(x => x.id === parcelamentoId);
  if (!p) return;
  // v0.11.0: usa obterCompleto pra ter acesso ao resumo (datas inicio/fim/quitação)
  const detalhe = _api('parcelamentos:obterCompleto', { parcelamentoId });
  const r = detalhe?.resumo;
  const valorParcela = detalhe ? Math.round(detalhe.valorTotalCentavos / detalhe.numParcelas) : (p.valorTotalCentavos / p.numParcelas);
  const pagoPct = Math.round((p.parcelasPagas / p.numParcelas) * 100);
  // Colunas de listarParcelas: 0:id, 1:numero, 2:dataVencimento, 3:valorCentavos, 4:status, 5:lancamentoId, 6:faturaId, 7:pagaEm
  const parcelas = detalhe ? detalhe.parcelas.map(x => [x.id, x.numero, x.dataVencimento, x.valorCentavos, x.status, x.lancamentoId, x.faturaId, x.pagaEm]) : [];
  container.style.display = 'block';
  container.innerHTML = `
    <div class="panel" style="border-color: var(--brand);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h2>📋 Parcelas — ${escapeHtml(p.descricao)}</h2>
        <button class="button secondary" id="parcelamento-detalhes-fechar">Fechar</button>
      </div>
      ${r ? `
      <div class="cards" style="margin-bottom: 14px;">
        <div class="card" style="padding: 10px 14px;">
          <span class="card-label">Valor parcela</span>
          <span class="card-value" style="font-size:18px;">${money(valorParcela)}</span>
          <span class="card-sub">${p.numParcelas}x</span>
        </div>
        <div class="card" style="padding: 10px 14px;">
          <span class="card-label">1ª parcela</span>
          <span class="card-value" style="font-size:18px;">${r.primeiroVencimento ? fmtData(r.primeiroVencimento) : '—'}</span>
          <span class="card-sub">data de início</span>
        </div>
        <div class="card" style="padding: 10px 14px;">
          <span class="card-label">Última parcela</span>
          <span class="card-value" style="font-size:18px;">${r.ultimoVencimento ? fmtData(r.ultimoVencimento) : '—'}</span>
          <span class="card-sub">vence em</span>
        </div>
        <div class="card" style="padding: 10px 14px;">
          <span class="card-label">${r.dataQuitacao ? 'Quitado em' : 'Progresso'}</span>
          <span class="card-value" style="font-size:18px; ${r.dataQuitacao ? 'color: var(--positive);' : ''}">${r.dataQuitacao ? fmtData(r.dataQuitacao) : pagoPct + '%'}</span>
          <span class="card-sub">${r.dataQuitacao ? 'parcelamento 100% pago' : `${p.parcelasPagas}/${p.numParcelas} parcelas pagas`}</span>
        </div>
      </div>
      <p class="subtitle">
        <strong>${money(p.valorTotalCentavos)}</strong> em ${p.numParcelas} parcelas de <strong>${money(valorParcela)}</strong>.
        Pago: <strong style="color: var(--positive);">${money(r.totalPagoCentavos)}</strong>
        ${r.totalPendenteCentavos > 0 ? ` · Falta: <strong style="color: var(--negative);">${money(r.totalPendenteCentavos)}</strong>` : ''}
        ${r.duracaoMeses > 0 ? ` · Duração: <strong>${r.duracaoMeses} meses</strong>` : ''}
      </p>
      ` : `
      <p class="subtitle">${p.numParcelas} parcelas de ${money(valorParcela)} (total ${money(p.valorTotalCentavos)}). Pago: ${p.parcelasPagas}/${p.numParcelas} (${pagoPct}%).</p>
      `}
      ${parcelas.length === 0 ? '<div class="empty">Nenhuma parcela cadastrada.</div>' : `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Paga em</th><th>Fatura</th><th></th></tr>
          </thead>
          <tbody>
            ${parcelas.map(par => {
              const [id, numero, dataVenc, valor, status, lancId, fatId, pagaEm] = par;
              const statusPill = status === 'paga'
                ? '<span class="pill" style="color:var(--positive);">✓ Paga</span>'
                : '<span class="pill warn">Pendente</span>';
              return `
                <tr>
                  <td><strong>${numero}/${p.numParcelas}</strong></td>
                  <td>${fmtData(dataVenc)}</td>
                  <td>${money(valor)}</td>
                  <td>${statusPill}</td>
                  <td>${pagaEm ? fmtData(String(pagaEm)) : '—'}</td>
                  <td>${fatId ? `Fatura #${fatId}` : '—'}</td>
                  <td>
                    ${status === 'pendente' ? `<button class="button ghost small parcelamento-pagar" data-id="${id}" data-valor="${valor}" data-venc="${dataVenc}">Pagar</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      `}
    </div>
  `;
  document.getElementById('parcelamento-detalhes-fechar').onclick = () => { container.style.display = 'none'; };
  document.querySelectorAll('button.parcelamento-pagar').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      if (!confirm(`Marcar esta parcela como paga em ${fmtData(btn.dataset.venc)} (R$ ${(Number(btn.dataset.valor) / 100).toFixed(2)})?`)) return;
      try {
        _api('parcelamentos:pagarParcela', { parcelaId: id, dataPagamento: btn.dataset.venc });
        if (globalThis.toastOk) toastOk('Parcela paga.');
        renderParcelamentos(_contextoId, _api);
      } catch (err) {
        if (globalThis.toastErr) toastErr('Erro: ' + err.message);
      }
    };
  });
}

function formParcelamento(pExistente, cartoes, categorias, contas) {
  const container = document.getElementById('parcelamento-form-container');
  const isEdit = !!pExistente;
  // Pega o cartao padrao do contexto (primeiro cartao)
  const cartaoPadrao = cartoes.length > 0 ? cartoes[0] : null;
  const p = isEdit ? {
    descricao: pExistente.descricao,
    valorTotal: (Number(pExistente.valorTotalCentavos) / 100).toFixed(2).replace('.', ','),
    numParcelas: pExistente.numParcelas,
    cartaoId: pExistente.cartaoId,
    categoriaId: pExistente.categoriaId,
    contaPagamentoId: null,
    diaVencimento: pExistente.diaVencimento,
    dataPrimeiraParcela: pExistente.dataPrimeiraParcela,
  } : {
    descricao: '', valorTotal: '', numParcelas: 12,
    cartaoId: cartaoPadrao ? cartaoPadrao[0] : null,
    categoriaId: null,
    contaPagamentoId: contas.length > 0 ? contas[0][0] : null,
    diaVencimento: 10,
    dataPrimeiraParcela: new Date().toISOString().slice(0, 10),
  };
  container.style.display = 'block';
  container.innerHTML = `
    <div class="panel" style="border-color: var(--brand);">
      <h2>${isEdit ? 'Editar' : 'Novo'} parcelamento</h2>
      <p class="subtitle">Compra parcelada em N vezes. Cada parcela vira um lançamento automático na fatura do mês certo do cartão.</p>
      <form id="parcelamento-form">
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Descrição *</span>
            <input type="text" name="descricao" value="${escapeHtml(p.descricao)}" required maxlength="120" placeholder="Ex: iPhone 15 Pro, TV 55 polegadas, Fogão" />
          </label>
          <label class="field">
            <span class="field-label">Valor TOTAL (R$) *</span>
            <input type="number" name="valorTotal" value="${p.valorTotal}" step="0.01" min="0.01" required placeholder="0,00" />
            <span class="field-help">Valor da compra inteira. Será dividido pelo n° de parcelas.</span>
          </label>
          <label class="field">
            <span class="field-label">Número de parcelas *</span>
            <input type="number" name="numParcelas" value="${p.numParcelas}" required min="2" max="48" />
            <span class="field-help">De 2 até 48 vezes.</span>
          </label>
          <label class="field">
            <span class="field-label">Cartão *</span>
            <select name="cartaoId" required>
              <option value="">— escolha o cartão —</option>
              ${cartoes.map(c => `<option value="${c[0]}" ${c[0] === p.cartaoId ? 'selected' : ''}>${escapeHtml(c[2])} ${c[3] ? '(' + escapeHtml(c[3]) + ')' : ''}</option>`).join('')}
            </select>
            <span class="field-help">As parcelas vão cair automaticamente na fatura deste cartão.</span>
          </label>
          <label class="field">
            <span class="field-label">Data da 1ª parcela *</span>
            <input type="date" name="dataPrimeiraParcela" value="${p.dataPrimeiraParcela}" required />
            <span class="field-help">A data que a 1ª parcela vence. As outras são +1 mês, +2 meses, etc.</span>
          </label>
          <label class="field">
            <span class="field-label">Dia de vencimento (1-31)</span>
            <input type="number" name="diaVencimento" value="${p.diaVencimento}" min="1" max="31" />
            <span class="field-help">Se a data da 1ª não usar, sistema usa esse dia. Em meses curtos, usa o último dia do mês.</span>
          </label>
          <label class="field">
            <span class="field-label">Categoria</span>
            <select name="categoriaId">
              <option value="">— sem categoria —</option>
              ${categorias.map(cat => `<option value="${cat[0]}" ${cat[0] === p.categoriaId ? 'selected' : ''}>${escapeHtml(cat[2])}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" id="parcelamento-cancelar">Cancelar</button>
          <button type="submit" class="button">${isEdit ? 'Salvar' : 'Criar parcelamento'}</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('parcelamento-cancelar').onclick = () => { container.style.display = 'none'; };
  document.getElementById('parcelamento-form').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = {
      contextoId: _contextoId,
      descricao: f.get('descricao').trim(),
      valorTotalCentavos: Math.round(Number(String(f.get('valorTotal')).replace(',', '.')) * 100),
      numParcelas: Number(f.get('numParcelas')),
      cartaoId: Number(f.get('cartaoId')),
      categoriaId: f.get('categoriaId') ? Number(f.get('categoriaId')) : null,
      diaVencimento: Number(f.get('diaVencimento')) || 10,
      dataPrimeiraParcela: f.get('dataPrimeiraParcela'),
    };
    try {
      const r = _api('parcelamentos:criar', data);
      const valorParcela = (r.totalCentavos / r.totalParcelas / 100).toFixed(2);
      if (globalThis.toastOk) toastOk(`Parcelamento criado: ${r.totalParcelas}x R$ ${valorParcela} (total R$ ${(r.totalCentavos / 100).toFixed(2)}).`);
      renderParcelamentos(_contextoId, _api);
    } catch (err) {
      if (globalThis.toastErr) toastErr('Erro: ' + err.message);
    }
  };
}

// v0.11.1: Modal de deteccao automatica de parcelados a partir do extrato importado.
// Lista candidatos por cartao e deixa o user escolher quais criar.
function abrirModalDeteccao(cartoes) {
  // Pra cada cartao, busca os candidatos
  const grupos = [];
  for (const c of cartoes) {
    const det = _api('parcelamentos:detectarDoExtrato', { contextoId: _contextoId, cartaoId: c[0] });
    if (det.length > 0) grupos.push({ cartao: c, candidatos: det });
  }
  if (grupos.length === 0) {
    if (globalThis.toastOk) toastOk('Nenhum parcelado novo encontrado no extrato. Tudo certo!');
    return;
  }
  // Calcula totais
  const totalCandidatos = grupos.reduce((s, g) => s + g.candidatos.length, 0);
  const totalIncompletos = grupos.reduce((s, g) => s + g.candidatos.filter(c => !c.completo).length, 0);
  // Cria overlay + modal
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'parcelamento-deteccao-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width: 720px; max-height: 85vh; overflow-y:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h2 style="margin:0;">🔍 Parcelados detectados no extrato</h2>
        <button class="button secondary" id="parcelamento-deteccao-fechar">Fechar</button>
      </div>
      <p class="subtitle">Achei <strong>${totalCandidatos}</strong> compra(s) parcelada(s) nos extratos importados. ${totalIncompletos > 0 ? `<strong style="color:var(--negative);">${totalIncompletos}</strong> tao incompletas (faltam parcelas).` : ''} Marca quais quer transformar em parcelamento. O sistema vincula automaticamente os lancamentos existentes e cria as parcelas que faltam.</p>
      <div style="margin-bottom:12px;">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" id="parcelamento-deteccao-todos" checked />
          <span><strong>Selecionar todos</strong></span>
        </label>
      </div>
      ${grupos.map(g => `
        <div class="panel" style="border-color: var(--brand); margin-bottom:10px;">
          <h3 style="margin:0 0 8px 0;">💳 ${escapeHtml(g.cartao[2])} <span style="color:var(--muted); font-size:13px; font-weight:normal;">(${g.candidatos.length} candidato(s))</span></h3>
          ${g.candidatos.map((c, idx) => {
            const statusLabel = c.completo
              ? '<span class="pill" style="color:var(--positive);">✓ ' + c.parcelasDetectadas + '/' + c.totalParcelas + '</span>'
              : '<span class="pill warn">' + c.parcelasDetectadas + '/' + c.totalParcelas + ' (falta)</span>';
            const itemIds = c.itens.map(i => i.lancamentoId).join(',');
            return `
              <label style="display:flex; align-items:center; gap:10px; padding:6px 0; cursor:pointer; border-top: 1px solid var(--border);">
                <input type="checkbox" class="parcelamento-deteccao-item" data-cartoid="${g.cartao[0]}" data-itens="${itemIds}" data-nome="${escapeHtml(c.nomeBase)}" data-total="${c.totalParcelas}" data-valor="${c.valorTotalCentavos}" data-nome-real="${escapeHtml(c.nomeBase)}" checked />
                <div style="flex:1;">
                  <strong>${escapeHtml(c.nomeBase)}</strong>
                  <div style="font-size:12px; color:var(--muted);">${c.totalParcelas}x ${money(c.valorTotalCentavos / c.totalParcelas)} = ${money(c.valorTotalCentavos)}</div>
                </div>
                ${statusLabel}
              </label>
            `;
          }).join('')}
        </div>
      `).join('')}
      <div class="form-actions" style="margin-top: 16px;">
        <button class="button" id="parcelamento-deteccao-criar">✓ Criar parcelamentos selecionados</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  // Fechar
  document.getElementById('parcelamento-deteccao-fechar').onclick = () => overlay.remove();
  // Selecionar todos
  document.getElementById('parcelamento-deteccao-todos').onchange = (e) => {
    overlay.querySelectorAll('input.parcelamento-deteccao-item').forEach(cb => cb.checked = e.target.checked);
  };
  // Criar
  document.getElementById('parcelamento-deteccao-criar').onclick = () => {
    const selecionados = Array.from(overlay.querySelectorAll('input.parcelamento-deteccao-item:checked'));
    if (selecionados.length === 0) {
      if (globalThis.toastWarn) toastWarn('Selecione pelo menos 1 candidato.');
      return;
    }
    // Agrupa por cartao e chama a rota de cada um
    const porCartao = new Map();
    for (const cb of selecionados) {
      const cartaoId = Number(cb.dataset.cartoid);
      if (!porCartao.has(cartaoId)) porCartao.set(cartaoId, []);
      // Recupera o candidato do backend (pra ter os dados completos)
      const todos = _api('parcelamentos:detectarDoExtrato', { contextoId: _contextoId, cartaoId });
      const c = todos.find(x => x.nomeBase === cb.dataset.nomeReal && x.totalParcelas === Number(cb.dataset.total));
      if (c) porCartao.get(cartaoId).push(c);
    }
    let totalCriados = 0, totalJaExistiam = 0, totalErros = 0;
    for (const [cartaoId, candidatos] of porCartao.entries()) {
      try {
        const r = _api('parcelamentos:criarDetectados', { contextoId: _contextoId, cartaoId, candidatos });
        for (const x of r) {
          if (x.ok) totalCriados++;
          else if (x.jaExistia) totalJaExistiam++;
          else totalErros++;
        }
      } catch (err) {
        if (globalThis.toastErr) toastErr('Erro: ' + err.message);
        return;
      }
    }
    overlay.remove();
    if (globalThis.toastOk) toastOk(`Pronto! ${totalCriados} parcelamento(s) criado(s)${totalJaExistiam > 0 ? `, ${totalJaExistiam} ja existia(m)` : ''}${totalErros > 0 ? `, ${totalErros} erro(s)` : ''}.`);
    renderParcelamentos(_contextoId, _api);
  };
}

function money(c) {
  return (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso) {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtMes(iso) {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
}
function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
