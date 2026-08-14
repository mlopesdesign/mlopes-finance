// MLopes Finance — Tela de Faturas de Cartao
// v0.9.0: lista faturas de um cartao (ou de todos os cartoes do contexto),
// mostra resumo, drill-down dos lancamentos, pagar fatura.

let _contextoId = null;
let _api = null;
let _cartaoFiltro = null; // vinda de cartoes.js via dataset.cartaoFiltro

export function renderFaturas(contextoId, api, cartaoFiltro = null) {
  _contextoId = contextoId;
  _api = api;
  if (cartaoFiltro != null) _cartaoFiltro = Number(cartaoFiltro);

  const cartoes = api('cartoes:listar', { contextoId });
  const contasBancarias = api('contas:listar', { contextoId }).filter(c => c[3] === 'bancaria');
  const cartaoSelecionado = _cartaoFiltro
    ? cartoes.find(c => c[0] === _cartaoFiltro)
    : null;
  // Reseta o filtro depois de usar
  if (cartaoFiltro != null) _cartaoFiltro = null;

  const faturas = cartaoSelecionado
    ? api('faturas:listarDetalhadas', { cartaoId: cartaoSelecionado[0] })
    : [];
  // Colunas faturas: 0:id, 1:cartao_id, 2:ciclo, 3:data_fechamento, 4:data_vencimento,
  //                  5:valor_total_centavos, 6:valor_pago_centavos, 7:status,
  //                  8:criado_em, 9:atualizado_em, 10:qtd_lancamentos, 11:soma_lancamentos_centavos
  const contasById = new Map(api('contas:listar', { contextoId }).map(c => [c[0], c]));
  const cartoesById = new Map(cartoes.map(c => [c[0], c]));

  const app = document.getElementById('app');
  app.innerHTML = `
    <span class="eyebrow">FASE 5</span>
    <h1>Faturas <em>de cartão</em></h1>
    <p class="subtitle">Cada compra no cartão cai automaticamente na fatura do ciclo certo (calculado pelo dia de fechamento). Aqui você vê o resumo, paga e drill-down dos lançamentos.</p>

    <div class="panel">
      <h2>Selecionar cartão</h2>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Cartão</span>
          <select id="fatura-cartao-select">
            <option value="">— escolha um cartão —</option>
            ${cartoes.map(c => `<option value="${c[0]}" ${cartaoSelecionado && c[0] === cartaoSelecionado[0] ? 'selected' : ''}>${escapeHtml(c[2])} (${escapeHtml(c[3] || '—')})</option>`).join('')}
          </select>
        </label>
      </div>
    </div>

    ${cartaoSelecionado ? `
      <div class="panel">
        <h2>${faturas.length} fatura(s) — ${escapeHtml(cartaoSelecionado[2])}</h2>
        ${faturas.length === 0 ? '<div class="empty">Nenhuma fatura aberta ainda. Cadastre um lançamento usando a conta automática deste cartão pra criar a primeira fatura.</div>' : `
        <div style="overflow-x:auto;">
          <table>
            <thead>
              <tr><th>Ciclo</th><th>Fechamento</th><th>Vencimento</th><th style="text-align:right;">Lançamentos</th><th style="text-align:right;">Total</th><th style="text-align:right;">Pago</th><th>Status</th><th style="text-align:right;">Ações</th></tr>
            </thead>
            <tbody>
              ${faturas.map(f => {
                const [id, , ciclo, dataF, dataV, total, pago, status, , , qtd, soma] = f;
                const totalFmt = (Number(total) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const pagoFmt = (Number(pago) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const statusClass = status === 'paga' ? 'pill' : status === 'fechada' ? 'pill warn' : 'pill is-static';
                return `
                  <tr>
                    <td><strong>${ciclo}</strong></td>
                    <td>${dataF}</td>
                    <td>${dataV}</td>
                    <td style="text-align:right;">${qtd}</td>
                    <td style="text-align:right;">${totalFmt}</td>
                    <td style="text-align:right;">${pagoFmt}</td>
                    <td><span class="${statusClass}">${status}</span></td>
                    <td style="text-align:right;">
                      <button class="button ghost small fatura-ver" data-id="${id}" data-ciclo="${ciclo}">Ver lançamentos</button>
                      ${status !== 'paga' ? `<button class="button ghost small fatura-pagar" data-id="${id}" data-ciclo="${ciclo}" data-total="${total}" data-pago="${pago}">Pagar</button>` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        `}
      </div>

      <div id="fatura-detalhes-container" style="display:none;"></div>
    ` : ''}
  `;

  const select = document.getElementById('fatura-cartao-select');
  if (select) {
    select.onchange = () => {
      const id = Number(select.value);
      if (id) {
        // Recarrega com filtro
        const fakeBtn = document.querySelector(`.nav-button[data-view="faturas"]`);
        if (fakeBtn) fakeBtn.dataset.cartaoFiltro = id;
        renderFaturas(_contextoId, _api, id);
      } else {
        renderFaturas(_contextoId, _api, null);
      }
    };
  }

  document.querySelectorAll('button.fatura-ver').forEach(btn => {
    btn.onclick = () => verLancamentosFatura(Number(btn.dataset.id), btn.dataset.ciclo, cartaoSelecionado[2], contasBancarias);
  });
  document.querySelectorAll('button.fatura-pagar').forEach(btn => {
    btn.onclick = () => formPagarFatura(Number(btn.dataset.id), btn.dataset.ciclo, Number(btn.dataset.total), Number(btn.dataset.pago), contasBancarias, cartaoSelecionado[2]);
  });
}

function verLancamentosFatura(faturaId, ciclo, cartaoNome, contasBancarias) {
  const container = document.getElementById('fatura-detalhes-container');
  const lancs = _api('faturas:listarLancamentos', { faturaId });
  // Colunas: 0:id, 1:contexto_id, 2:conta_id, 3:categoria_id, 4:natureza, 5:valor_centavos,
  //          6:data_competencia, 7:data_vencimento, 8:descricao, 9:observacoes, 10:status,
  //          11:criado_em, 12:categoria_nome, 13:conta_nome
  container.style.display = 'block';
  const total = lancs.reduce((s, l) => s + Number(l[5]), 0);
  container.innerHTML = `
    <div class="panel" style="border-color: var(--brand);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h2>📋 Lançamentos da fatura ${ciclo} — ${escapeHtml(cartaoNome)}</h2>
        <button class="button secondary" id="fatura-detalhes-fechar">Fechar</button>
      </div>
      <p class="subtitle">${lancs.length} lançamento(s) — Total: ${(total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      ${lancs.length === 0 ? '<div class="empty">Nenhum lançamento nesta fatura.</div>' : `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th style="text-align:right;">Valor</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${lancs.map(l => {
              const [id, , , , , valor, data, , desc, , status, , cat] = l;
              const valorFmt = (Number(valor) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              return `<tr>
                <td>${data}</td>
                <td>${escapeHtml(String(desc || ''))}</td>
                <td>${escapeHtml(cat || '—')}</td>
                <td style="text-align:right;">${valorFmt}</td>
                <td>${status}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      `}
    </div>
  `;
  document.getElementById('fatura-detalhes-fechar').onclick = () => { container.style.display = 'none'; };
}

function formPagarFatura(faturaId, ciclo, totalCentavos, pagoCentavos, contasBancarias, cartaoNome) {
  if (contasBancarias.length === 0) {
    if (globalThis.toastErr) toastErr('Cadastre uma conta bancária antes de pagar fatura.');
    return;
  }
  const restante = Number(totalCentavos) - Number(pagoCentavos);
  if (restante <= 0) {
    if (globalThis.toastWarn) toastWarn('Esta fatura já está paga.');
    return;
  }
  const container = document.getElementById('fatura-detalhes-container') || document.getElementById('fatura-form-container') || document.body;
  // Cria um painel temporário
  const temp = document.createElement('div');
  temp.id = 'pagar-fatura-temp';
  temp.innerHTML = `
    <div class="panel" style="border-color: var(--brand); position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:100; min-width:400px; max-width:90vw;">
      <h2>💳 Pagar fatura ${ciclo} — ${escapeHtml(cartaoNome)}</h2>
      <p class="subtitle">Total: R$ ${(Number(totalCentavos) / 100).toFixed(2)} • Pago: R$ ${(Number(pagoCentavos) / 100).toFixed(2)} • Restante: <strong>R$ ${(restante / 100).toFixed(2)}</strong></p>
      <form id="pagar-fatura-form">
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Conta que paga *</span>
            <select name="contaPagamentoId" required>
              <option value="">— escolha —</option>
              ${contasBancarias.map(c => `<option value="${c[0]}">${escapeHtml(c[2])}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span class="field-label">Valor (R$) *</span>
            <input type="number" name="valor" value="${(restante / 100).toFixed(2).replace('.', ',')}" step="0.01" min="0.01" max="${(restante / 100).toFixed(2)}" required />
            <span class="field-help">Pode pagar parcial (mínimo R$ 0,01).</span>
          </label>
          <label class="field">
            <span class="field-label">Data do pagamento *</span>
            <input type="date" name="dataPagamento" value="${new Date().toISOString().slice(0, 10)}" required />
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" id="pagar-fatura-cancelar">Cancelar</button>
          <button type="submit" class="button">Pagar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(temp);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:99;';
  document.body.appendChild(overlay);
  document.getElementById('pagar-fatura-cancelar').onclick = () => { temp.remove(); overlay.remove(); };
  overlay.onclick = () => { temp.remove(); overlay.remove(); };
  document.getElementById('pagar-fatura-form').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const valorCentavos = Math.round(Number(String(f.get('valor')).replace(',', '.')) * 100);
    try {
      const out = _api('faturas:pagar', {
        faturaId,
        contaPagamentoId: Number(f.get('contaPagamentoId')),
        valorCentavos,
        dataPagamento: f.get('dataPagamento'),
      });
      if (globalThis.toastOk) toastOk(`Fatura paga: R$ ${(valorCentavos / 100).toFixed(2)}. Status: ${out.status}.`);
      temp.remove(); overlay.remove();
      renderFaturas(_contextoId, _api);
    } catch (err) {
      if (globalThis.toastErr) toastErr('Erro: ' + err.message);
    }
  };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
