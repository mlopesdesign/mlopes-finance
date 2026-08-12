// MLopes Finance — Tela de Configurações
// Sidebar de seções à esquerda + form à direita (padrão ml-* / ML Download Manager)

const SECOES = [
  { id: 'aparencia', titulo: 'Aparência', icon: '◐' },
  { id: 'identidade', titulo: 'Identidade', icon: '✦' },
  { id: 'financeiro', titulo: 'Financeiro', icon: '◈' },
  { id: 'avancado', titulo: 'Avançado', icon: '◇' },
];

let _contextoId = null;
let _api = null;
let _configCache = {};

export function renderConfiguracoes(contextoId, api, dbPath = '') {
  _contextoId = contextoId;
  _api = api;
  _configCache = _api('configuracoes:listar');

  const app = document.getElementById('app');
  app.innerHTML = `
    <span class="eyebrow">CONFIGURAÇÕES</span>
    <h1>Como o app se <em>parece</em> e se <em>comporta</em>.</h1>
    <p class="subtitle">Alterações salvas no banco local. Válidas para esta instalação.</p>

    <div class="settings-layout">
      <nav class="settings-nav" id="settings-nav">
        ${SECOES.map((s, i) => `<button class="nav-button ${i===0?'active':''}" data-section="${s.id}"><span>${s.icon} ${s.titulo}</span></button>`).join('')}
      </nav>

      <div>
        <section class="settings-section active" data-section="aparencia">
          <div class="panel">
            <h2>Aparência</h2>
            <div class="field-row">
              <div><div class="field-label">Tema</div><div class="field-help">Claro ou escuro. Persistido por instalação.</div></div>
              <div class="theme-toggle" id="theme-toggle">
                <button data-tema="light">☀ Claro</button>
                <button data-tema="dark">☾ Escuro</button>
              </div>
            </div>
            <div class="field-row">
              <div><div class="field-label">Cor da marca</div><div class="field-help">Cor primária de botões, links e destaques.</div></div>
              <div><input type="color" class="color-input" id="cfg-marca" /></div>
            </div>
          </div>
        </section>

        <section class="settings-section" data-section="identidade">
          <div class="panel">
            <h2>Identidade</h2>
            <div class="field-row">
              <div><div class="field-label">Nome de exibição</div><div class="field-help">Como o app se chama na interface.</div></div>
              <div><input type="text" id="cfg-nome" maxlength="60" /></div>
            </div>
            <div class="field-row">
              <div><div class="field-label">Idioma (locale)</div><div class="field-help">pt-BR, en-US, es-ES…</div></div>
              <div><input type="text" id="cfg-locale" maxlength="10" /></div>
            </div>
          </div>
        </section>

        <section class="settings-section" data-section="financeiro">
          <div class="panel">
            <h2>Financeiro</h2>
            <div class="field-row">
              <div><div class="field-label">Moeda padrão</div><div class="field-help">BRL, USD, EUR…</div></div>
              <div><input type="text" id="cfg-moeda" maxlength="6" /></div>
            </div>
          </div>
        </section>

        <section class="settings-section" data-section="avancado">
          <div class="panel">
            <h2>Avançado</h2>
            <div class="field-row">
              <div><div class="field-label">Atualizações</div><div class="field-help">Checa novas versões no GitHub Releases. Avisa automaticamente ao abrir o app.</div></div>
              <div><button class="button" id="cfg-check-update">Verificar atualizações</button></div>
            </div>
            <div class="field-row">
              <div><div class="field-label">Exportar backup do banco</div><div class="field-help">Cria um arquivo .sqlite a partir do estado atual. Guarde em local seguro.</div></div>
              <div><button class="button" id="cfg-exportar-backup">Exportar backup…</button></div>
            </div>
            <div class="field-row">
              <div><div class="field-label">Restaurar de um backup</div><div class="field-help">Escolha um .sqlite exportado antes. O banco atual será substituído (com validação).</div></div>
              <div><button class="button secondary" id="cfg-restaurar-backup">Restaurar de arquivo…</button></div>
            </div>
            <div class="field-row">
              <div><div class="field-label">Radiografia do banco</div><div class="field-help">Contagem de registros por tabela essencial.</div></div>
              <div><button class="button secondary" id="cfg-radiografar">Verificar agora</button></div>
            </div>
            <div class="field-row">
              <div><div class="field-label">Restaurar padrão</div><div class="field-help">Apaga todas as configurações e volta aos defaults.</div></div>
              <div><button class="button danger" id="cfg-reset">Restaurar padrão de fábrica</button></div>
            </div>
            <div class="field-row">
              <div><div class="field-label">Banco de dados</div><div class="field-help" id="cfg-db-path">Carregando…</div></div>
              <div></div>
            </div>
            <div id="cfg-backup-status" class="field-help" style="margin-top: 12px;"></div>
          </div>
        </section>

        <div class="form-actions" style="margin-top: 24px;">
          <button class="button secondary" id="cfg-cancelar">Cancelar</button>
          <button class="button" id="cfg-salvar">Salvar alterações</button>
        </div>
      </div>
    </div>
  `;

  // Popular com os valores atuais
  popularForm();

  // Sidebar nav
  document.querySelectorAll('#settings-nav .nav-button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#settings-nav .nav-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
      const sec = btn.dataset.section;
      document.querySelector(`.settings-section[data-section="${sec}"]`).classList.add('active');
    };
  });

  // Theme toggle (preview ao vivo, salva no Salvar)
  document.querySelectorAll('#theme-toggle button').forEach(btn => {
    btn.onclick = () => {
      const tema = btn.dataset.tema;
      _configCache.tema = { valor: tema, tipo: 'texto' };
      aplicarPreview();
    };
  });

  // Marca preview ao vivo
  document.getElementById('cfg-marca').oninput = (e) => {
    _configCache.marca_cor = { valor: e.target.value, tipo: 'cor' };
    aplicarPreview();
  };

  // Path do banco (debug info)
  const dbPathEl = document.getElementById('cfg-db-path');
  if (dbPathEl) dbPathEl.textContent = dbPath || 'caminho nao disponivel';

  document.getElementById('cfg-salvar').onclick = salvar;
  document.getElementById('cfg-cancelar').onclick = () => location.reload();
  document.getElementById('cfg-reset').onclick = resetar;
  document.getElementById('cfg-exportar-backup').onclick = exportarBackup;
  document.getElementById('cfg-restaurar-backup').onclick = restaurarBackup;
  document.getElementById('cfg-radiografar').onclick = radiografar;
  document.getElementById('cfg-check-update').onclick = checarUpdateManual;
}

async function checarUpdateManual() {
  setBackupStatus('Verificando atualizacoes no GitHub...');
  try {
    const upd = await import('../update.js');
    const out = await upd.checar(_api);
    if (out.erro) {
      setBackupStatus('Erro: ' + out.erro, true);
    } else if (out.temAtualizacao) {
      setBackupStatus(`Atualizacao disponivel: v${out.versao}. Veja o banner no topo.`);
      upd.abrirModal();
    } else if (out.versao === out.versaoAtual) {
      setBackupStatus(`Voce ja esta na versao mais recente (v${out.versaoAtual}).`);
    } else {
      setBackupStatus(`Versao no GitHub: v${out.versao} (a sua e v${out.versaoAtual}). Estranho.`);
    }
  } catch (e) {
    setBackupStatus('Erro: ' + e.message, true);
  }
}

function popularForm() {
  const c = _configCache;
  document.querySelectorAll('#theme-toggle button').forEach(b => b.classList.toggle('active', b.dataset.tema === (c.tema?.valor ?? 'dark')));
  document.getElementById('cfg-marca').value = c.marca_cor?.valor ?? '#155e6f';
  document.getElementById('cfg-nome').value = c.nome_exibicao?.valor ?? 'MLopes Finance';
  document.getElementById('cfg-locale').value = c.locale?.valor ?? 'pt-BR';
  document.getElementById('cfg-moeda').value = c.moeda?.valor ?? 'BRL';
  aplicarPreview();
}

function aplicarPreview() {
  const c = _configCache;
  const tema = c.tema?.valor ?? 'dark';
  const marca = c.marca_cor?.valor ?? '#155e6f';
  document.documentElement.setAttribute('data-theme', tema);
  document.documentElement.style.setProperty('--brand', marca);
  document.querySelectorAll('#theme-toggle button').forEach(b => b.classList.toggle('active', b.dataset.tema === tema));
}

function salvar() {
  try {
    const c = _configCache;
    const novoNome = document.getElementById('cfg-nome').value.trim() || 'MLopes Finance';
    const novoLocale = document.getElementById('cfg-locale').value.trim() || 'pt-BR';
    const novaMoeda = document.getElementById('cfg-moeda').value.trim().toUpperCase() || 'BRL';
    _api('configuracoes:salvar', { chave: 'tema', valor: c.tema?.valor ?? 'dark', tipo: 'texto' });
    _api('configuracoes:salvar', { chave: 'marca_cor', valor: c.marca_cor?.valor ?? '#155e6f', tipo: 'cor' });
    _api('configuracoes:salvar', { chave: 'nome_exibicao', valor: novoNome, tipo: 'texto' });
    _api('configuracoes:salvar', { chave: 'locale', valor: novoLocale, tipo: 'texto' });
    _api('configuracoes:salvar', { chave: 'moeda', valor: novaMoeda, tipo: 'texto' });
    location.reload();
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
  }
}

function resetar() {
  if (!confirm('Apagar todas as configurações e voltar aos defaults?')) return;
  _api('configuracoes:resetar');
  location.reload();
}

function setBackupStatus(msg, isError = false) {
  const el = document.getElementById('cfg-backup-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--danger)' : 'var(--muted)';
}

async function exportarBackup() {
  setBackupStatus('Gerando backup…');
  try {
    const bytes = _api('backup:exportar');
    if (!bytes || !(bytes instanceof Uint8Array)) throw new Error('Backup vazio ou inválido.');
    const NL = globalThis.Neutralino;
    if (!NL?.os?.showSaveDialog) throw new Error('Dialog de salvamento não disponível.');
    const data = new Date().toISOString().slice(0, 10);
    const caminho = await NL.os.showSaveDialog('Exportar backup do banco', {
      defaultPath: `mlopes-finance-backup-${data}.sqlite`,
      filters: [{ name: 'SQLite', extensions: ['sqlite'] }],
    });
    if (!caminho) {
      setBackupStatus('Cancelado.');
      return;
    }
    await NL.filesystem.writeBinaryFile(caminho, bytes);
    setBackupStatus(`Backup exportado: ${caminho} (${formatBytes(bytes.length)})`);
  } catch (e) {
    setBackupStatus('Erro: ' + e.message, true);
  }
}

async function restaurarBackup() {
  setBackupStatus('Escolhendo arquivo…');
  try {
    const NL = globalThis.Neutralino;
    if (!NL?.os?.showOpenDialog) throw new Error('Dialog de abertura não disponível.');
    const [caminho] = await NL.os.showOpenDialog('Escolher arquivo de backup', {
      filters: [{ name: 'SQLite', extensions: ['sqlite'] }],
      multiSelections: false,
    });
    if (!caminho) {
      setBackupStatus('Cancelado.');
      return;
    }
    const bytes = await NL.filesystem.readBinaryFile(caminho);
    if (!confirm(`Restaurar este backup? O banco atual será substituído. Continuar?`)) {
      setBackupStatus('Cancelado.');
      return;
    }
    const out = _api('backup:restaurar', { bytes });
    setBackupStatus(`Backup restaurado. Registros: ${JSON.stringify(out.contagens)}`);
  } catch (e) {
    setBackupStatus('Erro: ' + e.message, true);
  }
}

function radiografar() {
  try {
    const r = _api('backup:radiografar');
    setBackupStatus('Contagens: ' + Object.entries(r).map(([t, n]) => `${t}=${n}`).join('  '));
  } catch (e) {
    setBackupStatus('Erro: ' + e.message, true);
  }
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}
