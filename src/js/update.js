// MLopes Finance — UI de Auto-update (pill no header, banner dismissible, modal)
// Mantem state global _updateState e expoe renderPill() / renderBanner() / abrirModal()
// Chamado pelo app.js no boot e em cada renderHeader/render

const DISMISS_KEY = 'mlopes-update-dismissed-until';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

let _state = {
  verificando: false,
  ultima: null, // resultado de checarAtualizacao
  dismissed: false,
};

function dismissed() {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() < until;
  } catch { return false; }
}
function setDismissed() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_TTL_MS)); } catch { /* */ }
}
function clearDismissed() {
  try { localStorage.removeItem(DISMISS_KEY); } catch { /* */ }
}

/** Chama checarAtualizacao e atualiza o state. Retorna o resultado. */
export async function checar(api) {
  _state.verificando = true;
  _state.dismissed = dismissed();
  renderPill();
  try {
    const out = await api('update:checar', {});
    _state.ultima = out;
    _state.verificando = false;
    if (out?.temAtualizacao) clearDismissed();
    renderPill();
    renderBanner();
    return out;
  } catch (e) {
    _state.verificando = false;
    renderPill();
    return { erro: e.message, temAtualizacao: false };
  }
}

/** Renderiza (ou atualiza) a pill no header (próximo a "VERSÃO X.Y.Z"). */
export function renderPill() {
  const actions = document.getElementById('topbar-actions');
  if (!actions) return;
  // Remove pill antiga se existir
  const old = document.getElementById('update-pill');
  if (old) old.remove();

  if (_state.verificando) {
    const el = document.createElement('span');
    el.id = 'update-pill';
    el.className = 'pill is-static update-pill';
    el.textContent = '↻ Verificando…';
    el.title = 'Procurando atualizacoes no GitHub';
    actions.insertBefore(el, actions.firstChild);
    return;
  }
  if (_state.ultima?.temAtualizacao && !_state.dismissed) {
    const el = document.createElement('button');
    el.id = 'update-pill';
    el.className = 'pill update-available';
    el.innerHTML = `🟡 v${_state.ultima.versao} disponivel`;
    el.title = 'Clique para ver detalhes da atualizacao';
    el.onclick = abrirModal;
    actions.insertBefore(el, actions.firstChild);
  }
}

/** Renderiza (ou atualiza) o banner dismissible no topo do #app. */
export function renderBanner() {
  // Remove banner antigo
  const old = document.getElementById('update-banner');
  if (old) old.remove();

  if (!_state.ultima?.temAtualizacao || _state.dismissed) return;

  const u = _state.ultima;
  const app = document.getElementById('app');
  if (!app) return;

  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.innerHTML = `
    <div class="update-banner-content">
      <strong>🟡 Atualizacao disponivel</strong>
      <span>Versao <code>${u.versao}</code> disponivel (voce esta na <code>v${u.versaoAtual}</code>). ${u.asset ? `${u.asset.tamanhoMB} MB.` : ''}</span>
    </div>
    <div class="update-banner-actions">
      <button class="button" id="upd-atualizar">Atualizar agora</button>
      <button class="button secondary" id="upd-detalhes">Ver detalhes</button>
      <button class="button secondary" id="upd-depois">Mais tarde</button>
    </div>
  `;
  app.insertBefore(banner, app.firstChild);

  document.getElementById('upd-atualizar').onclick = aplicar;
  document.getElementById('upd-detalhes').onclick = abrirModal;
  document.getElementById('upd-depois').onclick = () => {
    _state.dismissed = true;
    setDismissed();
    renderBanner();
    renderPill();
  };
}

/** Abre modal com changelog e botao atualizar. */
export function abrirModal() {
  if (!_state.ultima) return;
  const u = _state.ultima;
  // Remove modal antigo
  const old = document.getElementById('update-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'update-modal';
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true">
      <header class="modal-header">
        <h2>Atualizacao disponivel: v${u.versao}</h2>
        <button class="modal-close" id="upd-close" aria-label="Fechar">×</button>
      </header>
      <div class="modal-body">
        <p class="modal-meta">
          Sua versao atual: <code>v${u.versaoAtual}</code> &middot;
          ${u.asset ? `Instalador: <code>${u.asset.nome}</code> (${u.asset.tamanhoMB} MB)` : 'Instalador nao encontrado na release.'} &middot;
          Publicada em ${u.publicadoEm ? new Date(u.publicadoEm).toLocaleString('pt-BR') : '—'}.
        </p>
        ${u.asset?.sha256 ? `<p class="modal-meta"><small>SHA256: <code>${u.asset.sha256}</code></small></p>` : ''}
        <h3>Notas da versao</h3>
        <pre class="changelog">${escapeHtml(u.changelog || '(sem notas)')}</pre>
        <p class="modal-meta">
          <a href="${u.url}" target="_blank" rel="noopener">Ver no GitHub ↗</a>
        </p>
      </div>
      <footer class="modal-actions">
        <button class="button secondary" id="upd-cancelar">Mais tarde</button>
        <button class="button" id="upd-aplicar" ${u.asset ? '' : 'disabled'}>
          ${u.asset ? 'Atualizar agora' : 'Instalador indisponivel'}
        </button>
      </footer>
    </div>
  `;
  document.body.appendChild(modal);

  const fechar = () => modal.remove();
  document.getElementById('upd-close').onclick = fechar;
  document.getElementById('upd-cancelar').onclick = () => {
    _state.dismissed = true;
    setDismissed();
    renderBanner();
    renderPill();
    fechar();
  };
  if (u.asset) {
    document.getElementById('upd-aplicar').onclick = aplicar;
  }
  // Click fora do modal-content fecha
  modal.onclick = (e) => { if (e.target === modal) fechar(); };
}

let _aplicando = false;
async function aplicar() {
  if (_aplicando) return;
  if (!_state.ultima?.asset) {
    alert('Instalador nao encontrado na release. Baixe manualmente no GitHub.');
    return;
  }
  _aplicando = true;
  const u = _state.ultima;
  const destino = 'C:\\Windows\\Temp\\MLopesFinance-Update.exe';
  // Feedback
  const btn = document.getElementById('upd-aplicar');
  const btnBanner = document.getElementById('upd-atualizar');
  if (btn) { btn.disabled = true; btn.textContent = 'Baixando…'; }
  if (btnBanner) { btnBanner.disabled = true; btnBanner.textContent = 'Baixando…'; }

  try {
    const api = window._appApi;
    if (!api) throw new Error('API nao disponivel.');
    const out = await api('update:baixar', { assetUrl: u.asset.url, destino });
    if (out?.erro) throw new Error(out.erro);
    const out2 = await api('update:aplicar', { caminho: destino });
    if (out2?.erro) throw new Error(out2.erro);
  } catch (e) {
    alert('Erro: ' + e.message);
    _aplicando = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Atualizar agora'; }
    if (btnBanner) { btnBanner.disabled = false; btnBanner.textContent = 'Atualizar agora'; }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
