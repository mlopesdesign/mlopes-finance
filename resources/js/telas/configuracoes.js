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

export function renderConfiguracoes(contextoId, api) {
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
              <div><div class="field-label">Restaurar padrão</div><div class="field-help">Apaga todas as configurações e volta aos defaults.</div></div>
              <div><button class="button danger" id="cfg-reset">Restaurar padrão de fábrica</button></div>
            </div>
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

  document.getElementById('cfg-salvar').onclick = salvar;
  document.getElementById('cfg-cancelar').onclick = () => location.reload();
  document.getElementById('cfg-reset').onclick = resetar;
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
