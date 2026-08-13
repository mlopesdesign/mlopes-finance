// MLopes Finance — UI do auto-update (PADRAO secao 5 + UI similar ao
// "Salgueiro Gestao"). E chamado pelo app.js depois do boot.
//
// API exportada:
//   renderPill()           — (re)desenha a pill no header mostrando versao
//                            disponivel. Idempotente.
//   checar(api)            — consulta GH via api('update:checar'); se tiver
//                            atualizacao, atualiza pill + banner.
//   renderPainel(api, slot) — renderiza o bloco "Atualizacao do sistema" no
//                            slot passado (Configuracoes > Avancado).
//                            Inclui botao "Verificar agora", card com
//                            changelog e botao "Baixar e instalar".
//   baixarEAplicar(api)    — fluxo completo: backup do banco + download +
//                            aplicar. Atualiza UI a cada passo.
//
// Estado interno: as ultimas info do update ficam em `_state` para
// reuso entre pill/banner/modal.

let _state = {
  versaoAtual: '0.0.0',
  tagName: null,
  temAtualizacao: false,
  bodyHtml: '',
  body: '',
  asset: null,
  publicadoEm: null,
  motivo: null,
  verificadoEm: null,
  baixando: false,
  percentual: 0,
  erro: null,
};

// Renderiza/atualiza a pill no header. Se nao houver pill, cria.
export function renderPill() {
  const actions = document.getElementById('topbar-actions');
  if (!actions) return;
  let pill = document.getElementById('update-pill');
  if (!pill) {
    pill = document.createElement('button');
    pill.id = 'update-pill';
    pill.className = 'pill update-pill is-hidden';
    pill.type = 'button';
    pill.addEventListener('click', () => irParaAtualizacao());
    actions.appendChild(pill);
  }
  if (_state.temAtualizacao) {
    pill.classList.remove('is-hidden');
    pill.innerHTML = `<span class="dot"></span>Nova versão ${_state.tagName} disponível`;
    pill.title = `Atualização ${_state.tagName} disponível. Clique para ver.`;
  } else {
    pill.classList.add('is-hidden');
  }
}

// Consulta o backend e atualiza o estado. Retorna o estado.
export async function checar(api, opts = {}) {
  // Se o caller passou versaoAtual, usa; senao, busca do estado do app
  // (injetado por app.js como globalThis._appVersion).
  if (opts.versaoAtual) _state.versaoAtual = opts.versaoAtual;
  else if (globalThis._appVersion) _state.versaoAtual = globalThis._appVersion;
  try {
    // O backend usa APP_VERSION do ambiente, mas passamos tambem para
    // garantir (e para o estado da UI bater com o que foi checado).
    const r = await api('update:checar');
    _state = {
      ..._state,
      ...r,
      versaoAtual: r.versaoAtual || _state.versaoAtual,
      verificadoEm: new Date().toISOString(),
      erro: null,
    };
  } catch (e) {
    _state.erro = e?.message || 'falha ao verificar';
    _state.temAtualizacao = false;
  }
  renderPill();
  // Atualiza o painel da Configuracoes > Avancado se ele estiver visivel
  const slot = document.getElementById('atualizacao-slot');
  if (slot) renderPainalNoSlot(api, slot);
  return _state;
}

// Rende o painel completo de atualizacao no elemento `slot`. Idempotente.
export function renderPainel(api, slot) {
  if (!slot) return;
  renderPainalNoSlot(api, slot);
}

function renderPainalNoSlot(api, slot) {
  slot.innerHTML = `
    <div class="atualizacao-bloco">
      <div class="atualizacao-cabecalho">
        <span class="atualizacao-titulo">🔄 Atualização do sistema</span>
        <span class="atualizacao-versao">Versão instalada: <strong>v${_state.versaoAtual}</strong></span>
        <p class="atualizacao-sub">As atualizações são baixadas do GitHub e aplicadas automaticamente — sem reinstalar o sistema.</p>
      </div>
      <div class="atualizacao-acoes">
        <button class="button" id="atualizacao-checar" ${_state.erro ? '' : 'disabled'}>Verificar agora</button>
        <span class="atualizacao-status" id="atualizacao-status"></span>
      </div>
      <div class="atualizacao-conteudo" id="atualizacao-conteudo">
        ${renderConteudo()}
      </div>
    </div>
  `;
  const btn = document.getElementById('atualizacao-checar');
  if (btn) btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'Verificando…';
    await checar(api);
    btn.disabled = false;
    btn.textContent = 'Verificar agora';
  };
  const btnBaixar = document.getElementById('atualizacao-baixar');
  if (btnBaixar) btnBaixar.onclick = () => baixarEAplicar(api);
}

function renderConteudo() {
  if (_state.erro) {
    return `<div class="atualizacao-erro">❌ ${escapeHtml(_state.erro)}</div>`;
  }
  if (!_state.verificadoEm) {
    return `<div class="atualizacao-info">Clique em <strong>Verificar agora</strong> para buscar uma atualização no GitHub.</div>`;
  }
  if (!_state.temAtualizacao) {
    if (_state.motivo === 'asset-nao-encontrado') {
      return `<div class="atualizacao-info">Versão mais recente no GitHub: <strong>${escapeHtml(_state.tagName || '')}</strong>, mas o asset <code>resources.neu</code> não foi anexado. Sem atualização automática disponível.</div>`;
    }
    return `<div class="atualizacao-ok">✅ Você já está na versão mais recente.</div>`;
  }
  // Ha atualizacao
  return `
    <div class="atualizacao-card">
      <div class="atualizacao-card-titulo">🆙 Nova versão disponível: <strong>${escapeHtml(_state.tagName)}</strong> <span class="atualizacao-atual">(atual: v${escapeHtml(_state.versaoAtual)})</span></div>
      <div class="atualizacao-changelog" id="atualizacao-changelog">${_state.bodyHtml || '<em>Sem changelog.</em>'}</div>
      <div class="atualizacao-progresso" id="atualizacao-progresso" style="display:none">
        <div class="atualizacao-barra"><div class="atualizacao-barra-fill" id="atualizacao-barra-fill"></div></div>
        <div class="atualizacao-progresso-texto" id="atualizacao-progresso-texto">⏳ Baixando…</div>
      </div>
      <div class="atualizacao-acoes-card">
        <button class="button" id="atualizacao-baixar">⬇ Baixar e instalar</button>
      </div>
    </div>
  `;
}

// Fluxo de download + aplicacao. Faz backup do banco via api, depois baixa
// e aplica. Atualiza o progresso no DOM.
export async function baixarEAplicar(api) {
  if (!_state.temAtualizacao || !_state.asset) {
    alert('Nada para baixar. Verifique primeiro.');
    return;
  }
  const btn = document.getElementById('atualizacao-baixar');
  const prog = document.getElementById('atualizacao-progresso');
  const progTexto = document.getElementById('atualizacao-progresso-texto');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Baixando…'; }
  if (prog) prog.style.display = 'block';
  if (progTexto) progTexto.textContent = '⏳ Baixando resources.neu…';
  try {
    const r = await api('update:baixar', { assetUrl: _state.asset.url });
    if (progTexto) progTexto.textContent = `✅ Download concluído (${formatBytes(r.size)}). Aplicando…`;
    // Aplicar (a rota `update:aplicar` faz backup do banco antes de mover)
    if (btn) btn.textContent = '⏳ Aplicando…';
    const a = await api('update:aplicar');
    if (a.reiniciado) {
      if (progTexto) progTexto.textContent = '✅ Atualização aplicada! Reiniciando em 2 s…';
    } else {
      if (progTexto) progTexto.textContent = `✅ Atualização aplicada. Reinicie o app manualmente. (${a.erro || ''})`;
    }
  } catch (e) {
    if (progTexto) progTexto.textContent = `❌ Falha: ${e?.message || e}`;
    if (btn) { btn.disabled = false; btn.textContent = '⬇ Tentar novamente'; }
  }
}

// Tenta ir direto pra Configuracoes > Avancado. Se ainda nao renderizou,
// clica no botao "Configuracoes" da sidebar.
function irParaAtualizacao() {
  const btn = Array.from(document.querySelectorAll('.nav-button')).find(
    (b) => b.dataset.view === 'configuracoes'
  );
  if (btn) btn.click();
  // Aguarda render e rola ate o bloco de atualizacao
  setTimeout(() => {
    const el = document.getElementById('atualizacao-slot');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 250);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatBytes(n) {
  if (!n || n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
