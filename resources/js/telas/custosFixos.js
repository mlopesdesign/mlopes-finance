// MLopes Finance — Tela de Custos Fixos (v0.10.0)
// Cadastra despesas recorrentes mensais (aluguel, internet, luz, etc) com
// a conta/cartao de pagamento. O sistema gera os lancamentos automaticamente
// todo mes. Mostra total mensal + quanto ja foi pago.

let _contextoId = null;
let _api = null;

export function renderCustosFixos(contextoId, api) {
  _contextoId = contextoId;
  _api = api;

  const contas = api('contas:listar', { contextoId });
  const categorias = api('categorias:listar', { contextoId }).filter(c => c[3] === 'despesa' || c[3] === 'ambas');
  const resumo = api('custosFixos:resumoMes', { contextoId });
  const total = api('custosFixos:totalMes', { contextoId });
  // Colunas resumo.custosFixos: 0: custoFixoId, 1: recorrenciaId, 2: descricao, 3: valorCentavos,
  // 4: diaDoMes, 5: contaId, 6: contaNome, 7: tipoConta, 8: categoriaId, 9: categoriaNome,
  // 10: ativo, 11: proximaGeracao, 12: gerado, 13: lancamentoId, 14: statusGerado
  const fmtTipo = (t) => t === 'bancaria' ? 'Conta' : t === 'cartao' ? 'Cartão' : t === 'investimento' ? 'Invest.' : t;

  const app = document.getElementById('app');
  app.innerHTML = `
    <span class="eyebrow">FASE 7</span>
    <h1>Custos <em>fixos</em></h1>
    <p class="subtitle">Despesas recorrentes mensais (aluguel, internet, luz...). Cadastra uma vez, o sistema gera os lançamentos todo mês.</p>

    <div class="cards">
      <div class="card">
        <span class="card-label">Total previsto</span>
        <span class="card-value">${money(total.totalCentavos)}</span>
        <span class="card-sub">${total.qtdCustosFixos} custo(s) fixo(s) ativo(s) / mês</span>
      </div>
      <div class="card">
        <span class="card-label">Pago em ${resumo.mes}</span>
        <span class="card-value" style="color: var(--positive);">${money(resumo.totalPagoCentavos)}</span>
        <span class="card-sub">${resumo.percentualPago.toFixed(0)}% do previsto</span>
      </div>
      <div class="card">
        <span class="card-label">A pagar em ${resumo.mes}</span>
        <span class="card-value" style="color: var(--negative);">${money(Math.max(0, resumo.totalPrevistoCentavos - resumo.totalPagoCentavos))}</span>
        <span class="card-sub">${100 - resumo.percentualPago.toFixed(0)}% restante</span>
      </div>
      <div class="card">
        <span class="card-label">Custos cadastrados</span>
        <span class="card-value">${resumo.custosFixos.length}</span>
        <span class="card-sub">${resumo.custosFixos.filter(c => c.ativo).length} ativos · ${resumo.custosFixos.filter(c => !c.ativo).length} pausados</span>
      </div>
    </div>

    <div class="panel">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h2>📋 Custos fixos (${resumo.custosFixos.length})</h2>
        <div style="display:flex; gap:8px;">
          <button class="button ghost small" id="custosfixos-gerar" title="Gerar os lançamentos de ${resumo.mes} que ainda faltam">⚡ Gerar ${resumo.mes}</button>
          <button class="button" id="custosfixos-novo">+ Novo custo fixo</button>
        </div>
      </div>
      ${resumo.custosFixos.length === 0 ? '<div class="empty">Nenhum custo fixo cadastrado. Clique em "+ Novo custo fixo" pra começar (ex: aluguel R$ 1.500, dia 10, conta BB).</div>' : `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr><th>Custo</th><th>Dia</th><th>Conta/Cartão</th><th>Categoria</th><th style="text-align:right;">Valor</th><th>Status ${resumo.mes}</th><th>Ativo</th><th style="text-align:right;">Ações</th></tr>
          </thead>
          <tbody>
            ${resumo.custosFixos.map(c => {
              const valorFmt = (Number(c.valorCentavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              const statusMes = c.gerado
                ? `<span class="pill" style="color:var(--positive);">✓ Gerado ${c.statusGerado ? '(' + c.statusGerado + ')' : ''}</span>`
                : `<span class="pill warn">Pendente</span>`;
              const ativoLabel = c.ativo
                ? `<span class="pill" style="color:var(--positive);">Ativo</span>`
                : `<span class="pill warn">Pausado</span>`;
              return `
                <tr>
                  <td><strong>${escapeHtml(c.descricao)}</strong></td>
                  <td>dia ${c.diaDoMes}</td>
                  <td>${escapeHtml(c.contaNome)} <span class="pill is-static" style="font-size:10px;">${fmtTipo(c.tipoConta)}</span></td>
                  <td>${c.categoriaNome ? escapeHtml(c.categoriaNome) : '<span class="muted">—</span>'}</td>
                  <td style="text-align:right;">${valorFmt}</td>
                  <td>${statusMes}</td>
                  <td>${ativoLabel}</td>
                  <td style="text-align:right;">
                    <button class="button ghost small custosfixos-alternar" data-id="${c.custoFixoId}" data-ativo="${c.ativo ? 'false' : 'true'}">${c.ativo ? 'Pausar' : 'Ativar'}</button>
                    <button class="button ghost small danger custosfixos-excluir" data-id="${c.custoFixoId}" data-nome="${escapeHtml(c.descricao)}">Excluir</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      `}
    </div>

    <div id="custosfixos-form-container" style="display:none;"></div>
  `;

  // Listeners
  document.getElementById('custosfixos-novo').onclick = () => formCustoFixo(null, contas, categorias);
  document.getElementById('custosfixos-gerar').onclick = () => {
    try {
      const out = _api('custosFixos:gerarMesAtual', { contextoId: _contextoId });
      if (out.totalGerado > 0) {
        if (globalThis.toastOk) toastOk(`${out.totalGerado} custo(s) fixo(s) gerado(s) em ${resumo.mes}.`);
      } else {
        if (globalThis.toastInfo) toastInfo(`Todos os custos fixos de ${resumo.mes} ja foram gerados.`);
      }
      renderCustosFixos(_contextoId, _api);
    } catch (err) {
      if (globalThis.toastErr) toastErr('Erro: ' + err.message);
    }
  };
  document.querySelectorAll('button.custosfixos-alternar').forEach(btn => {
    btn.onclick = () => {
      try {
        const ativo = btn.dataset.ativo === 'true';
        _api('custosFixos:alternar', { custoFixoId: Number(btn.dataset.id), ativo });
        if (globalThis.toastOk) toastOk(ativo ? 'Custo fixo ativado.' : 'Custo fixo pausado.');
        renderCustosFixos(_contextoId, _api);
      } catch (err) {
        if (globalThis.toastErr) toastErr('Erro: ' + err.message);
      }
    };
  });
  document.querySelectorAll('button.custosfixos-excluir').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      const nome = btn.dataset.nome;
      if (!confirm(`Excluir o custo fixo "${nome}"? Por padrão ele só é pausado (mantém histórico). Pra apagar de verdade (template + recorrencia), clique "OK" e confirme o cascade.`)) return;
      try {
        const r = _api('custosFixos:excluir', { custoFixoId: id });
        if (r.cascade) {
          if (globalThis.toastOk) toastOk('Custo fixo excluído em cascata.');
        } else {
          if (globalThis.toastOk) toastOk('Custo fixo pausado (pode reativar depois).');
        }
        renderCustosFixos(_contextoId, _api);
      } catch (err) {
        if (globalThis.toastErr) toastErr('Erro: ' + err.message);
      }
    };
  });
}

function formCustoFixo(cfExistente, contas, categorias) {
  const container = document.getElementById('custosfixos-form-container');
  const isEdit = !!cfExistente;
  const c = isEdit ? {
    descricao: cfExistente.descricao,
    valor: (Number(cfExistente.valorCentavos) / 100).toFixed(2).replace('.', ','),
    diaDoMes: cfExistente.diaDoMes,
    contaId: cfExistente.contaId,
    categoriaId: cfExistente.categoriaId,
    ativo: cfExistente.ativo,
  } : { descricao: '', valor: '', diaDoMes: 1, contaId: null, categoriaId: null, ativo: true };
  container.style.display = 'block';
  container.innerHTML = `
    <div class="panel" style="border-color: var(--brand);">
      <h2>${isEdit ? 'Editar' : 'Novo'} custo fixo</h2>
      <p class="subtitle">Custo recorrente que se repete todo mês no mesmo dia. Ex: aluguel dia 10, internet dia 15.</p>
      <form id="custosfixos-form">
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Descrição *</span>
            <input type="text" name="descricao" value="${escapeHtml(c.descricao)}" required maxlength="80" placeholder="Ex: Aluguel, Internet Vivo, Energia CEEE" />
          </label>
          <label class="field">
            <span class="field-label">Valor mensal (R$) *</span>
            <input type="number" name="valor" value="${c.valor}" step="0.01" min="0.01" required placeholder="0,00" />
          </label>
          <label class="field">
            <span class="field-label">Dia do mês (1-31) *</span>
            <input type="number" name="diaDoMes" value="${c.diaDoMes}" required min="1" max="31" />
            <span class="field-help">Em meses com menos dias (ex: 31 em fevereiro), usa o último dia do mês.</span>
          </label>
          <label class="field">
            <span class="field-label">Pago por *</span>
            <select name="contaId" required>
              <option value="">— escolha a conta ou cartão —</option>
              ${contas.map(c2 => `<option value="${c2[0]}" ${c2[0] === c.contaId ? 'selected' : ''}>${escapeHtml(c2[2])} (${c2[3]})</option>`).join('')}
            </select>
            <span class="field-help">Conta bancária ou cartão de crédito por onde o custo é pago.</span>
          </label>
          <label class="field">
            <span class="field-label">Categoria</span>
            <select name="categoriaId">
              <option value="">— sem categoria —</option>
              ${categorias.map(cat => `<option value="${cat[0]}" ${cat[0] === c.categoriaId ? 'selected' : ''}>${escapeHtml(cat[2])}</option>`).join('')}
            </select>
          </label>
          <label class="field" style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" name="ativo" ${c.ativo ? 'checked' : ''} />
            <span>Custo fixo ativo (desmarque pra pausar temporariamente)</span>
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" id="custosfixos-cancelar">Cancelar</button>
          <button type="submit" class="button">${isEdit ? 'Salvar' : 'Criar custo fixo'}</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('custosfixos-cancelar').onclick = () => { container.style.display = 'none'; };
  document.getElementById('custosfixos-form').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = {
      contextoId: _contextoId,
      descricao: f.get('descricao').trim(),
      valorCentavos: Math.round(Number(String(f.get('valor')).replace(',', '.')) * 100),
      diaDoMes: Number(f.get('diaDoMes')),
      contaId: Number(f.get('contaId')),
      categoriaId: f.get('categoriaId') ? Number(f.get('categoriaId')) : null,
      ativo: f.get('ativo') === 'on',
    };
    try {
      if (isEdit) {
        // Edicao simples: desativa+recria. Pra MVP isso e' OK porque
        // editar valor/descricao nao muda a recorrencia em si.
        _api('custosFixos:excluir', { custoFixoId: c.id, cascade: true });
        const r = _api('custosFixos:criar', data);
        if (globalThis.toastOk) toastOk('Custo fixo atualizado. Lançamentos gerados a partir do próximo mês.');
      } else {
        const r = _api('custosFixos:criar', data);
        if (globalThis.toastOk) toastOk(`Custo fixo criado. Será gerado em ${data.diaDoMes}/${String(new Date().getMonth() + 2).padStart(2, '0')}.`);
      }
      renderCustosFixos(_contextoId, _api);
    } catch (err) {
      if (globalThis.toastErr) toastErr('Erro: ' + err.message);
    }
  };
}

function money(c) {
  return (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
