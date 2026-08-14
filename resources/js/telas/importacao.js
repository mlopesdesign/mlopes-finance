// MLopes Finance — Tela de Importação de Extratos (OFX / CSV)
// Fluxo: selecionar arquivo -> previa -> escolher conta -> confirmar
// v0.8.8-hotfix2: header explicito "Vai para" + toast em todas as acoes

let _contextoId = null;
let _api = null;
let _importacaoAtual = null; // id da importacao em status 'previa'
let _contasCache = [];
let _contextoNome = '';
let _contextoPill = null;

export function renderImportacao(contextoId, api) {
  _contextoId = contextoId;
  _api = api;
  _importacaoAtual = null;
  _contasCache = api('contas:listar', { contextoId });
  // Pega o nome do contexto ativo
  try {
    const ctxs = api('contextos:listar', { incluirInativos: true });
    const ctx = ctxs.find((c) => c[0] === contextoId);
    _contextoNome = ctx ? ctx[1] : '—';
  } catch { _contextoNome = '—'; }

  const app = document.getElementById('app');
  app.innerHTML = `
    <span class="eyebrow">FASE 5</span>
    <h1>Importar <em>extrato</em> bancário</h1>
    <p class="subtitle">OFX ou CSV. Detecta duplicidade por data, valor e descrição. Nada é criado até você confirmar.</p>

    <div class="panel" id="imp-destino-panel">
      <h2>📍 Para onde vão os dados</h2>
      <div class="field-row">
        <div>
          <div class="field-label">Contexto financeiro</div>
          <div class="field-help">Os lançamentos serão criados dentro deste contexto.</div>
        </div>
        <div><span class="pill is-static" id="imp-destino-contexto">${escapeHtml(_contextoNome)}</span></div>
      </div>
      <div class="field-row">
        <div>
          <div class="field-label">Conta de destino</div>
          <div class="field-help" id="imp-destino-conta-help">Escolha abaixo, na etapa 3, antes de confirmar.</div>
        </div>
        <div><span class="pill is-static" id="imp-destino-conta">— não definida —</span></div>
      </div>
      <div class="field-row" id="imp-destino-resumo" style="display:none;">
        <div>
          <div class="field-label">Resumo da prévia</div>
          <div class="field-help" id="imp-destino-resumo-texto">—</div>
        </div>
        <div></div>
      </div>
    </div>

    <div class="panel">
      <h2>1. Selecionar arquivo</h2>
      <div class="field-row">
        <div>
          <div class="field-label">Arquivo</div>
          <div class="field-help">Suporta .ofx e .csv (com cabeçalho na primeira linha).</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="file" id="imp-file" accept=".ofx,.csv,.qfx,.txt" style="flex:1;" />
          <button class="button" id="imp-pre-visualizar">Pré-visualizar</button>
        </div>
      </div>
      <div id="imp-previa-info" class="field-help" style="margin-top: 12px;"></div>
    </div>

    <div class="panel" id="imp-previa-panel" style="display:none;">
      <h2>2. Pré-visualização</h2>
      <p class="field-help" id="imp-previa-resumo"></p>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Status</th></tr>
          </thead>
          <tbody id="imp-previa-tbody"></tbody>
        </table>
      </div>
    </div>

    <div class="panel" id="imp-confirmar-panel" style="display:none;">
      <h2>3. Confirmar importação</h2>
      <div class="field-row">
        <div>
          <div class="field-label">Conta de destino</div>
          <div class="field-help">A natureza (receita/despesa) é inferida automaticamente pelo tipo da conta e pela descrição. Pra conferir, veja os badges na prévia acima.</div>
        </div>
        <div>
          <select id="imp-conta">
            <option value="">— escolha uma conta —</option>
            ${_contasCache.map(c => `<option value="${c[0]}">${escapeHtml(c[2])}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-actions" style="margin-top: 16px;">
        <button class="button secondary" id="imp-cancelar">Cancelar importação</button>
        <button class="button" id="imp-confirmar">Confirmar importação</button>
      </div>
    </div>

    <div class="panel" id="imp-resultado-panel" style="display:none;">
      <h2>4. Resultado</h2>
      <div id="imp-resultado"></div>
    </div>

    <div class="panel">
      <h2>Histórico de importações</h2>
      <div id="imp-historico"></div>
    </div>
  `;

  // Quando muda a conta no select, atualiza o pill "Para onde"
  const selConta = document.getElementById('imp-conta');
  if (selConta) selConta.onchange = () => atualizarDestinoPill();

  document.getElementById('imp-pre-visualizar').onclick = preVisualizar;
  document.getElementById('imp-confirmar').onclick = confirmar;
  document.getElementById('imp-cancelar').onclick = cancelar;

  renderHistorico();
}

function atualizarDestinoPill() {
  const sel = document.getElementById('imp-conta');
  const pill = document.getElementById('imp-destino-conta');
  if (!sel || !pill) return;
  const id = Number(sel.value);
  if (!id) { pill.textContent = '— não definida —'; return; }
  const c = _contasCache.find((x) => x[0] === id);
  pill.textContent = c ? c[2] : '—';
}

async function preVisualizar() {
  const fileInput = document.getElementById('imp-file');
  const file = fileInput.files?.[0];
  if (!file) {
    if (globalThis.toastWarn) toastWarn('Selecione um arquivo .ofx ou .csv primeiro.');
    document.getElementById('imp-previa-info').textContent = 'Selecione um arquivo .ofx ou .csv primeiro.';
    return;
  }
  const info = document.getElementById('imp-previa-info');
  info.textContent = `Lendo ${file.name} (${formatBytes(file.size)})…`;

  const formato = detectarFormato(file.name);
  if (!formato) {
    if (globalThis.toastErr) toastErr(`Formato não reconhecido em "${file.name}". Use .ofx, .qfx ou .csv.`);
    info.textContent = `Formato não reconhecido em "${file.name}". Use .ofx, .qfx ou .csv.`;
    return;
  }

  let conteudo;
  try {
    conteudo = await file.text();
  } catch (e) {
    if (globalThis.toastErr) toastErr('Erro lendo arquivo: ' + e.message);
    info.textContent = 'Erro lendo arquivo: ' + e.message;
    return;
  }

  try {
    const idImport = _api('importacao:criarPrevia', {
      contextoId: _contextoId,
      arquivoOrigem: file.name,
      formato,
      conteudo,
    });
    _importacaoAtual = idImport;
    const itens = _api('importacao:listarItens', { importacaoId: _importacaoAtual });
    const pendentes = itens.filter((i) => i[6] === 'pendente').length;
    const dupes = itens.filter((i) => i[6] === 'duplicado').length;
    info.textContent = `Prévia criada (#${idImport}). ${itens.length} transações (${pendentes} pendentes, ${dupes} já existem).`;
    if (globalThis.toastOk) toastOk(`Prévia #${idImport}: ${itens.length} transações (${pendentes} novas, ${dupes} duplicadas).`);
    // Resumo no painel "Para onde"
    document.getElementById('imp-destino-resumo').style.display = 'flex';
    document.getElementById('imp-destino-resumo-texto').textContent =
      `Prévia #${idImport} do arquivo "${file.name}": ${itens.length} transações, ${pendentes} serão importadas, ${dupes} já existem.`;
    renderTabelaPrevia();
    document.getElementById('imp-previa-panel').style.display = 'block';
    document.getElementById('imp-confirmar-panel').style.display = 'block';
  } catch (e) {
    if (globalThis.toastErr) toastErr('Erro na prévia: ' + e.message);
    info.textContent = 'Erro: ' + e.message;
  }
}

function renderTabelaPrevia() {
  if (!_importacaoAtual) return;
  const itens = _api('importacao:listarItens', { importacaoId: _importacaoAtual });
  const tbody = document.getElementById('imp-previa-tbody');
  if (!itens.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhum item encontrado.</td></tr>';
  } else {
    tbody.innerHTML = itens.map(([id, contaId, data, valor, descricao, , status]) => {
      const valorFmt = (Number(valor) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const statusFmt = status === 'duplicado'
        ? '<span class="pill warn">Duplicado</span>'
        : status === 'pendente'
          ? '<span class="pill is-static">Pendente</span>'
          : status;
      return `<tr><td>${data}</td><td>${escapeHtml(String(descricao || ''))}</td><td>${valorFmt}</td><td>${statusFmt}</td></tr>`;
    }).join('');
  }
  const pendentes = itens.filter(i => i[6] === 'pendente').length;
  const dupes = itens.filter(i => i[6] === 'duplicado').length;
  document.getElementById('imp-previa-resumo').textContent =
    `${itens.length} transações: ${pendentes} pendentes, ${dupes} já existem no banco (serão ignorados).`;
}

function confirmar() {
  if (!_importacaoAtual) {
    if (globalThis.toastWarn) toastWarn('Faça a pré-visualização primeiro.');
    return;
  }
  const contaId = Number(document.getElementById('imp-conta').value);
  if (!contaId) {
    if (globalThis.toastWarn) toastWarn('Escolha uma conta de destino antes de confirmar.');
    return;
  }
  // A natureza (receita/despesa) e' inferida automaticamente pelo backend.
  // Default 'despesa' e' o fallback se nao conseguir inferir (extrato bancario pessoal: tudo despesa).
  const itensAntes = _api('importacao:listarItens', { importacaoId: _importacaoAtual });
  const pendentes = itensAntes.filter((i) => i[6] === 'pendente').length;
  const c = _contasCache.find((x) => x[0] === contaId);
  const contaNome = c ? c[2] : `#${contaId}`;
  try {
    const out = _api('importacao:confirmar', {
      importacaoId: _importacaoAtual,
      contaId,
      padraoNatureza: 'despesa',
    });
    _importacaoAtual = null;
    document.getElementById('imp-resultado-panel').style.display = 'block';
    // Mostra resumo com inferencias (despesa vs receita)
    const inferidas = (out.inferencias || []).reduce((acc, i) => { acc[i.natureza] = (acc[i.natureza] || 0) + 1; return acc; }, {});
    const txtDespesa = inferidas.despesa || 0;
    const txtReceita = inferidas.receita || 0;
    const resumoNatureza = (txtDespesa || txtReceita)
      ? `<br><span class="muted" style="font-size:12px;">Inferido: <strong>${txtDespesa}</strong> despesa, <strong>${txtReceita}</strong> receita (palavras-chave + tipo da conta)</span>`
      : '';
    document.getElementById('imp-resultado').innerHTML =
      `<div class="success-card"><strong>${out.importados} lançamentos criados com sucesso</strong> em <em>${escapeHtml(_contextoNome)} › ${escapeHtml(contaNome)}</em>.${resumoNatureza}<br>Veja em <em>Lançamentos</em>.</div>`;
    document.getElementById('imp-previa-panel').style.display = 'none';
    document.getElementById('imp-confirmar-panel').style.display = 'none';
    document.getElementById('imp-destino-resumo').style.display = 'none';
    document.getElementById('imp-file').value = '';
    if (globalThis.toastOk) toastOk(`Importação concluída: ${out.importados} lançamentos em ${_contextoNome} › ${contaNome}.`, 5000);
    renderHistorico();
  } catch (e) {
    if (globalThis.toastErr) toastErr('Erro ao confirmar: ' + e.message, 6000);
  }
}

function cancelar() {
  if (!_importacaoAtual) {
    document.getElementById('imp-previa-panel').style.display = 'none';
    document.getElementById('imp-confirmar-panel').style.display = 'none';
    return;
  }
  if (!confirm('Cancelar esta importação? Os itens pendentes serão marcados como ignorados.')) return;
  try {
    _api('importacao:cancelar', { importacaoId: _importacaoAtual });
    _importacaoAtual = null;
    document.getElementById('imp-previa-panel').style.display = 'none';
    document.getElementById('imp-confirmar-panel').style.display = 'none';
    document.getElementById('imp-destino-resumo').style.display = 'none';
    document.getElementById('imp-previa-info').textContent = 'Importação cancelada.';
    if (globalThis.toastInfo) toastInfo('Importação cancelada.');
    renderHistorico();
  } catch (e) {
    if (globalThis.toastErr) toastErr('Erro ao cancelar: ' + e.message);
  }
}

function renderHistorico() {
  const div = document.getElementById('imp-historico');
  if (!div) return;
  const rows = _api('importacao:listar', { contextoId: _contextoId });
  if (!rows.length) {
    div.innerHTML = '<div class="empty">Nenhuma importação ainda.</div>';
    return;
  }
  // Colunas: id, contexto_id, arquivo_origem, formato, hash_arquivo, total_registros, total_importados, status, mapeamento_csv, criado_em
  div.innerHTML = `<table><thead><tr><th>#</th><th>Arquivo</th><th>Formato</th><th>Itens</th><th>Importados</th><th>Status</th><th>Data</th><th></th></tr></thead><tbody>${rows.map(r => {
    const statusClass = r[7] === 'confirmada' ? 'pill' : r[7] === 'cancelada' ? 'pill is-static' : 'pill warn';
    const importacoes = r[6] > 0;
    // v0.8.20: Botao "Reciclar" aparece quando a importacao tem itens 'ignorado'/'duplicado'
    // que podem voltar a 'pendente'. Caso classico: o user excluiu todos os lancamentos
    // e os 63 itens viraram 'ignorado'. Sem Reciclar, nao tinha como re-confirmar.
    const ignorarDup = _api('importacao:contarPorStatus', { importacaoId: r[0] });
    const reciclaveis = (ignorarDup.ignorado || 0) + (ignorarDup.duplicado || 0);
    return `<tr>
      <td>${r[0]}</td>
      <td>${escapeHtml(String(r[2] || ''))}</td>
      <td>${r[3]}</td>
      <td>${r[5]}</td>
      <td>${r[6]}</td>
      <td><span class="${statusClass}">${r[7]}</span></td>
      <td>${String(r[9] || '').replace('T', ' ').substring(0, 19)}</td>
      <td>
        ${reciclaveis > 0 ? `<button class="button ghost small" data-reciclar="${r[0]}" title="Marcar ${reciclaveis} item(ns) ignorado/duplicado como pendente para confirmar de novo">♻ Reciclar ${reciclaveis}</button> ` : ''}
        ${importacoes ? `<button class="button ghost small danger" data-excluir-lanc="${r[0]}" title="Excluir os ${r[6]} lançamentos desta importação (bloqueia se algum estiver conciliado)">Excluir ${r[6]} lanç.</button> ` : ''}
        <button class="button ghost small" data-excluir="${r[0]}" title="Excluir esta importação (lançamentos permanecem)">Excluir</button>
      </td>
    </tr>`;
  }).join('')}</tbody></table>`;
  // Listeners
  div.querySelectorAll('button[data-excluir]').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.excluir);
      if (!confirm(`Excluir a importação #${id}? Os itens pendentes/duplicados somem. Lançamentos já criados permanecem intactos.`)) return;
      try {
        _api('importacao:excluir', { importacaoId: id });
        if (globalThis.toastOk) toastOk(`Importação #${id} excluída.`);
        renderHistorico();
      } catch (e) {
        if (globalThis.toastErr) toastErr('Erro ao excluir: ' + e.message);
      }
    };
  });
  div.querySelectorAll('button[data-reciclar]').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.reciclar);
      if (!confirm(`Reciclar a importacao #${id}? Todos os itens 'ignorado'/'duplicado' voltam a 'pendente' e podem ser confirmados de novo.`)) return;
      try {
        const out = _api('importacao:reciclar', { importacaoId: id });
        if (globalThis.toastOk) toastOk(out.mensagem || `${out.reciclados} itens reciclados.`);
        renderHistorico();
      } catch (e) {
        if (globalThis.toastErr) toastErr('Erro: ' + e.message);
      }
    };
  });
  div.querySelectorAll('button[data-excluir-lanc]').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.excluirLanc);
      if (!confirm(`Excluir TODOS os lançamentos desta importação #${id}? As baixas vinculadas também. A importação será marcada como cancelada. ATENÇÃO: bloqueia se algum lançamento estiver conciliado (regra de auditoria).`)) return;
      try {
        const out = _api('importacao:excluirLancamentos', { importacaoId: id });
        if (out.ok) {
          if (globalThis.toastOk) toastOk(out.mensagem || `${out.excluidos} lançamentos excluídos.`);
        } else {
          if (globalThis.toastErr) toastErr(out.mensagem || 'Bloqueado.', 8000);
        }
        renderHistorico();
      } catch (e) {
        if (globalThis.toastErr) toastErr('Erro: ' + e.message);
      }
    };
  });
}

function detectarFormato(nome) {
  const ext = nome.toLowerCase().split('.').pop();
  if (ext === 'ofx' || ext === 'qfx') return 'ofx';
  if (ext === 'csv' || ext === 'txt') return 'csv';
  return null;
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
