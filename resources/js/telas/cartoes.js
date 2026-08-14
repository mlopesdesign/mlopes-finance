// MLopes Finance — Tela de Cartoes de Credito (CRUD)
// v0.9.0: cadastrar cartao (cria conta tipo 'cartao' automaticamente),
// ver faturas, pagar fatura, excluir (cascade se quiser).

let _contextoId = null;
let _api = null;

export function renderCartoes(contextoId, api) {
  _contextoId = contextoId;
  _api = api;

  const cartoes = api('cartoes:listar', { contextoId });
  const contasBancarias = api('contas:listar', { contextoId }).filter(c => c[3] === 'bancaria');
  // Colunas cartoes: 0:id, 1:contexto_id, 2:nome, 3:instituicao, 4:limite_centavos,
  //                  5:dia_fechamento, 6:dia_vencimento, 7:conta_pagamento_id,
  //                  8:conta_associada_id, 9:ativo, 10:criado_em, 11:atualizado_em
  const contasById = new Map(api('contas:listar', { contextoId }).map(c => [c[0], c]));

  const app = document.getElementById('app');
  app.innerHTML = `
    <span class="eyebrow">FASE 5</span>
    <h1>Cartões <em>de crédito</em></h1>
    <p class="subtitle">Cadastre seus cartões. O sistema cria uma conta automática (tipo 'cartao') e calcula o ciclo da fatura (fechamento + vencimento) pra cada compra.</p>

    <div class="panel">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h2>${cartoes.length} cartão(ões)</h2>
        <button class="button" id="cartao-novo">+ Novo cartão</button>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr><th>Nome</th><th>Instituição</th><th style="text-align:right;">Limite</th><th>Fechamento</th><th>Vencimento</th><th>Conta de pagamento</th><th style="text-align:right;">Ações</th></tr>
          </thead>
          <tbody>
            ${cartoes.length === 0 ? '<tr><td colspan="7" class="empty">Nenhum cartão cadastrado.</td></tr>' : cartoes.map(c => {
              const [id, , nome, instituicao, limite, diaF, diaV, contaPagId] = c;
              const contaPag = contaPagId ? contasById.get(contaPagId) : null;
              const limiteFmt = (Number(limite) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              return `
                <tr>
                  <td><strong>${escapeHtml(nome)}</strong></td>
                  <td>${escapeHtml(instituicao || '—')}</td>
                  <td style="text-align:right;">${limiteFmt}</td>
                  <td>dia ${diaF}</td>
                  <td>dia ${diaV}</td>
                  <td>${contaPag ? escapeHtml(contaPag[2]) : '<span class="muted">— não definida —</span>'}</td>
                  <td style="text-align:right;">
                    <button class="button ghost small cartao-editar" data-id="${id}">Editar</button>
                    <button class="button ghost small cartao-faturas" data-id="${id}" data-nome="${escapeHtml(nome)}">Faturas</button>
                    <button class="button ghost small danger cartao-excluir" data-id="${id}" data-nome="${escapeHtml(nome)}">Excluir</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div id="cartao-form-container" style="display:none;"></div>
  `;

  // Listeners
  document.getElementById('cartao-novo').onclick = () => formCartao(null, contasBancarias);
  document.querySelectorAll('button.cartao-editar').forEach(btn => {
    btn.onclick = () => formCartao(cartoes.find(c => c[0] === Number(btn.dataset.id)), contasBancarias);
  });
  document.querySelectorAll('button.cartao-faturas').forEach(btn => {
    btn.onclick = () => {
      // Marca ativo o botão de faturas e navega
      document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
      const faturasBtn = document.querySelector('.nav-button[data-view="faturas"]');
      if (faturasBtn) {
        faturasBtn.classList.add('active');
        faturasBtn.dataset.cartaoFiltro = btn.dataset.id;
        faturasBtn.dispatchEvent(new MouseEvent('click'));
      }
    };
  });
  document.querySelectorAll('button.cartao-excluir').forEach(btn => {
    btn.onclick = () => excluirCartaoFlow(Number(btn.dataset.id), btn.dataset.nome);
  });
}

function formCartao(cartaoExistente, contasBancarias) {
  const container = document.getElementById('cartao-form-container');
  const isEdit = !!cartaoExistente;
  // cartaoExistente colunas: 0:id, 2:nome, 3:instituicao, 4:limite_centavos, 5:dia_fechamento, 6:dia_vencimento, 7:conta_pagamento_id
  const c = isEdit ? {
    id: cartaoExistente[0],
    nome: cartaoExistente[2],
    instituicao: cartaoExistente[3],
    limite: cartaoExistente[4],
    diaF: cartaoExistente[5],
    diaV: cartaoExistente[6],
    contaPagId: cartaoExistente[7],
  } : { nome: '', instituicao: '', limite: 0, diaF: 5, diaV: 15, contaPagId: null };
  container.style.display = 'block';
  container.innerHTML = `
    <div class="panel" style="border-color: var(--brand);">
      <h2>${isEdit ? 'Editar' : 'Novo'} cartão</h2>
      <form id="cartao-form">
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Nome *</span>
            <input type="text" name="nome" value="${escapeHtml(c.nome)}" required maxlength="80" placeholder="Ex: Nubank, Inter, Santander..." />
          </label>
          <label class="field">
            <span class="field-label">Instituição</span>
            <input type="text" name="instituicao" value="${escapeHtml(c.instituicao || '')}" maxlength="80" placeholder="Ex: Nu Pagamentos, Banco Inter..." />
          </label>
          <label class="field">
            <span class="field-label">Limite (R$)</span>
            <input type="number" name="limite" value="${(Number(c.limite) / 100).toFixed(2).replace('.', ',')}" step="0.01" min="0" placeholder="0,00" />
          </label>
          <label class="field">
            <span class="field-label">Dia de fechamento (1-31) *</span>
            <input type="number" name="diaFechamento" value="${c.diaF}" required min="1" max="31" />
          </label>
          <label class="field">
            <span class="field-label">Dia de vencimento (1-31) *</span>
            <input type="number" name="diaVencimento" value="${c.diaV}" required min="1" max="31" />
          </label>
          <label class="field">
            <span class="field-label">Conta de pagamento</span>
            <select name="contaPagamentoId">
              <option value="">— escolha uma conta bancária —</option>
              ${contasBancarias.map(c2 => `<option value="${c2[0]}" ${c2[0] === c.contaPagId ? 'selected' : ''}>${escapeHtml(c2[2])}</option>`).join('')}
            </select>
            <span class="field-help">Conta BANCÁRIA que paga a fatura. Não confundir com a conta automática do cartão.</span>
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" id="cartao-cancelar">Cancelar</button>
          <button type="submit" class="button">${isEdit ? 'Salvar' : 'Criar cartão'}</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('cartao-cancelar').onclick = () => { container.style.display = 'none'; };
  document.getElementById('cartao-form').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = {
      contextoId: _contextoId,
      nome: f.get('nome').trim(),
      instituicao: f.get('instituicao').trim(),
      limiteCentavos: Math.round(Number(String(f.get('limite')).replace(',', '.')) * 100) || 0,
      diaFechamento: Number(f.get('diaFechamento')),
      diaVencimento: Number(f.get('diaVencimento')),
      contaPagamentoId: f.get('contaPagamentoId') ? Number(f.get('contaPagamentoId')) : null,
    };
    try {
      if (isEdit) {
        _api('cartoes:atualizar', { id: c.id, ...data });
        if (globalThis.toastOk) toastOk('Cartão atualizado.');
      } else {
        const r = _api('cartoes:criar', data);
        if (globalThis.toastOk) toastOk(`Cartão criado. Conta automática "${data.nome}" disponível nos lançamentos.`);
      }
      renderCartoes(_contextoId, _api);
    } catch (err) {
      if (globalThis.toastErr) toastErr('Erro: ' + err.message);
    }
  };
}

function excluirCartaoFlow(id, nome) {
  if (!confirm(`Excluir o cartão "${nome}"? Sem cascade: bloqueia se tem faturas com lançamentos. Com cascade: apaga cartão + faturas + desvincula lançamentos (a conta automática é desativada).`)) return;
  // Tenta sem cascade primeiro
  let r;
  try {
    r = _api('cartoes:excluir', { id });
  } catch (err) {
    if (globalThis.toastErr) toastErr('Erro: ' + err.message);
    return;
  }
  if (!r.ok && r.bloqueadoPor) {
    if (confirm(`${r.mensagem}\n\nDeseja excluir com CASCADE (apaga faturas e desvincula lançamentos)?`)) {
      try {
        const r2 = _api('cartoes:excluir', { id, cascade: true });
        if (globalThis.toastOk) toastOk(`Cartão excluído em cascata. ${r2.faturasRemovidas} fatura(s) removida(s).`);
        renderCartoes(_contextoId, _api);
      } catch (err) {
        if (globalThis.toastErr) toastErr('Erro: ' + err.message);
      }
    }
    return;
  }
  if (globalThis.toastOk) toastOk(`Cartão "${nome}" excluído.`);
  renderCartoes(_contextoId, _api);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
