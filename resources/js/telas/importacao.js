// MLopes Finance — Tela de Importação de Extratos (OFX / CSV)
// Fluxo: selecionar arquivo -> previa -> escolher conta -> confirmar

let _contextoId = null;
let _api = null;
let _importacaoAtual = null; // id da importacao em status 'previa'
let _contasCache = [];

export function renderImportacao(contextoId, api) {
  _contextoId = contextoId;
  _api = api;
  _importacaoAtual = null;
  _contasCache = api('contas:listar', { contextoId });

  const app = document.getElementById('app');
  app.innerHTML = `
    <span class="eyebrow">FASE 5</span>
    <h1>Importar <em>extrato</em> bancário</h1>
    <p class="subtitle">OFX ou CSV. Detecta duplicidade por data, valor e descrição. Nada é criado até você confirmar.</p>

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
      <h2>2. Prévia</h2>
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
          <div class="field-help">Todos os lançamentos serão criados nesta conta.</div>
        </div>
        <div>
          <select id="imp-conta">
            <option value="">— escolha uma conta —</option>
            ${_contasCache.map(c => `<option value="${c[0]}">${c[2]}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div>
          <div class="field-label">Natureza padrão (quando ambíguo)</div>
          <div class="field-help">Valores positivos viram receita, negativos viram despesa. Use isso para casos sem sinal.</div>
        </div>
        <div>
          <select id="imp-natureza">
            <option value="despesa" selected>Despesa</option>
            <option value="receita">Receita</option>
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

  document.getElementById('imp-pre-visualizar').onclick = preVisualizar;
  document.getElementById('imp-confirmar').onclick = confirmar;
  document.getElementById('imp-cancelar').onclick = cancelar;

  renderHistorico();
}

async function preVisualizar() {
  const fileInput = document.getElementById('imp-file');
  const file = fileInput.files?.[0];
  if (!file) {
    document.getElementById('imp-previa-info').textContent = 'Selecione um arquivo .ofx ou .csv primeiro.';
    return;
  }
  const info = document.getElementById('imp-previa-info');
  info.textContent = `Lendo ${file.name} (${formatBytes(file.size)})…`;

  const formato = detectarFormato(file.name);
  if (!formato) {
    info.textContent = `Formato não reconhecido em "${file.name}". Use .ofx, .qfx ou .csv.`;
    return;
  }

  let conteudo;
  try {
    conteudo = await file.text();
  } catch (e) {
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
    info.textContent = `Prévia criada (#${idImport}). ${formatBytes(file.size)} analisados.`;
    renderTabelaPrevia();
    document.getElementById('imp-previa-panel').style.display = 'block';
    document.getElementById('imp-confirmar-panel').style.display = 'block';
  } catch (e) {
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
      return `<tr><td>${data}</td><td>${String(descricao || '').replaceAll('<', '&lt;')}</td><td>${valorFmt}</td><td>${statusFmt}</td></tr>`;
    }).join('');
  }
  const pendentes = itens.filter(i => i[6] === 'pendente').length;
  const dupes = itens.filter(i => i[6] === 'duplicado').length;
  document.getElementById('imp-previa-resumo').textContent =
    `${itens.length} transações: ${pendentes} pendentes, ${dupes} já existem no banco (serão ignorados).`;
}

function confirmar() {
  if (!_importacaoAtual) {
    alert('Faça a pré-visualização primeiro.');
    return;
  }
  const contaId = Number(document.getElementById('imp-conta').value);
  if (!contaId) {
    alert('Escolha uma conta de destino.');
    return;
  }
  const natureza = document.getElementById('imp-natureza').value;
  try {
    const out = _api('importacao:confirmar', {
      importacaoId: _importacaoAtual,
      contaId,
      padraoNatureza: natureza,
    });
    _importacaoAtual = null;
    document.getElementById('imp-resultado-panel').style.display = 'block';
    document.getElementById('imp-resultado').innerHTML =
      `<div class="success-card"><strong>${out.importados} lançamentos criados com sucesso.</strong><br>Você pode vê-los em <em>Lançamentos</em>.</div>`;
    document.getElementById('imp-previa-panel').style.display = 'none';
    document.getElementById('imp-confirmar-panel').style.display = 'none';
    document.getElementById('imp-file').value = '';
    renderHistorico();
  } catch (e) {
    alert('Erro ao confirmar: ' + e.message);
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
    document.getElementById('imp-previa-info').textContent = 'Importação cancelada.';
    renderHistorico();
  } catch (e) {
    alert('Erro: ' + e.message);
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
  div.innerHTML = `<table><thead><tr><th>#</th><th>Arquivo</th><th>Formato</th><th>Itens</th><th>Importados</th><th>Status</th><th>Data</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td>${String(r[2] || '').replaceAll('<', '&lt;')}</td><td>${r[3]}</td><td>${r[5]}</td><td>${r[6]}</td><td>${r[7]}</td><td>${String(r[9] || '').replace('T', ' ').substring(0, 19)}</td></tr>`).join('')}</tbody></table>`;
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
