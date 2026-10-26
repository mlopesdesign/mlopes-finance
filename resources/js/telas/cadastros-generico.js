// MLopes Finance — tela generica para cadastros (clientes, fornecedores, projetos, centros_custo, tags, contas, categorias)
// Reaproveita o mesmo padrao de lista + form.
//
// v0.12.3: cada campo pode ter:
//   - tipo: 'texto' (default) | 'cor' | 'select'
//   - selectApi: API pra carregar options do select (ex: 'clientes:listar')
//   - selectValue: coluna do array de options que vai no value do <option> (default: 0 = id)
//   - selectLabel: coluna do array de options que vai no text do <option> (default: 2 = nome)
//   - selectVazio: texto da option vazia (default: '—')
//   - displayField: indice da coluna em `r` que aparece na tabela no lugar do campo principal
//     (usado em projetos pra mostrar cliente_nome em vez de cliente_id)
//
// v0.12.3: o select eh resolvido em runtime chamando a API uma vez por tela.
// Para selects simples (clientes, fornecedores) eh barato. Para selects grandes,
// considerar carregar sob demanda no form.

const MAPA = {
  clientes: { titulo: 'Clientes', apiListar: 'clientes:listar', apiCriar: 'clientes:criar', apiAtualizar: 'clientes:atualizar', apiExcluir: 'clientes:excluir', campos: [
    { nome: 'nome', label: 'Nome', tipo: 'texto', required: true },
    { nome: 'documento', label: 'Documento (CPF/CNPJ)', tipo: 'texto' },
    { nome: 'email', label: 'E-mail', tipo: 'texto' },
    { nome: 'telefone', label: 'Telefone', tipo: 'texto' },
    { nome: 'observacoes', label: 'Observacoes', tipo: 'texto' },
  ]},
  fornecedores: { titulo: 'Fornecedores', apiListar: 'fornecedores:listar', apiCriar: 'fornecedores:criar', apiAtualizar: 'fornecedores:atualizar', apiExcluir: 'fornecedores:excluir', campos: [
    { nome: 'nome', label: 'Nome', tipo: 'texto', required: true },
    { nome: 'documento', label: 'Documento (CPF/CNPJ)', tipo: 'texto' },
    { nome: 'observacoes', label: 'Observacoes', tipo: 'texto' },
  ]},
  projetos: { titulo: 'Projetos', apiListar: 'projetos:listar', apiCriar: 'projetos:criar', apiAtualizar: 'projetos:atualizar', apiExcluir: 'projetos:excluir', campos: [
    { nome: 'nome', label: 'Nome', tipo: 'texto', required: true },
    // v0.12.3: clienteId eh um select que carrega options via clientes:listar.
    // displayField=4 faz a tabela mostrar cliente_nome (r[4]) em vez de cliente_id (r[3]).
    { nome: 'clienteId', label: 'Cliente', tipo: 'select', selectApi: 'clientes:listar', selectValue: 0, selectLabel: 2, displayField: 4, selectVazio: '— Sem cliente —' },
    { nome: 'descricao', label: 'Descricao', tipo: 'texto' },
    { nome: 'dataInicio', label: 'Data início (dd/mm/aaaa)', tipo: 'texto' },
    { nome: 'dataFim', label: 'Data fim (dd/mm/aaaa)', tipo: 'texto' },
  ]},
  centros_custo: { titulo: 'Centros de custo', apiListar: 'centros_custo:listar', apiCriar: 'centros_custo:criar', apiAtualizar: 'centros_custo:atualizar', apiExcluir: 'centros_custo:excluir', campos: [
    { nome: 'nome', label: 'Nome', tipo: 'texto', required: true },
    { nome: 'descricao', label: 'Descricao', tipo: 'texto' },
  ]},
  tags: { titulo: 'Tags', apiListar: 'tags:listar', apiCriar: 'tags:criar', apiAtualizar: 'tags:atualizar', apiExcluir: 'tags:excluir', campos: [
    { nome: 'nome', label: 'Nome', tipo: 'texto', required: true },
    { nome: 'cor', label: 'Cor', tipo: 'cor' },
  ]},
};

// v0.12.3: carrega as options de um select sob demanda. Cacheia por (apiName) pra
// nao chamar a mesma API 5x no mesmo render.
// v0.12.4: BUG FIX — passar o contextoId pra API. Sem isso, listarClientes /
// listarFornecedores (que exigem contextoId) lancam "Contexto obrigatorio".
const _selectOptionsCache = new Map();
function carregarSelectOptions(api, selectApi, contextoId) {
  if (!selectApi) return [];
  // Cache key inclui o contextoId pra nao misturar options entre contextos
  const cacheKey = contextoId != null ? `${selectApi}::${contextoId}` : selectApi;
  if (_selectOptionsCache.has(cacheKey)) return _selectOptionsCache.get(cacheKey);
  const payload = contextoId != null ? { contextoId } : {};
  const opts = api(selectApi, payload) ?? [];
  _selectOptionsCache.set(cacheKey, opts);
  return opts;
}
function invalidarSelectOptionsCache() { _selectOptionsCache.clear(); }

export function renderCadastroGenerico(tipo, contextoId, api) {
  const cfg = MAPA[tipo];
  if (!cfg) throw new Error(`Cadastro generico nao configurado para ${tipo}`);
  invalidarSelectOptionsCache();
  const app = document.getElementById('app');
  const lista = api(cfg.apiListar, { contextoId });
  // v0.12.3: carrega options de selects uma unica vez por render
  for (const c of cfg.campos) if (c.tipo === 'select') carregarSelectOptions(api, c.selectApi, contextoId);
  const rows = lista.length ? lista.map((r) => {
    const id = r[0];
    const nome = String(r[2] ?? '').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
    const tds = cfg.campos.slice(1).map((c, j) => {
      // v0.12.3: se o campo tem displayField, usa essa coluna (ex: cliente_nome)
      const idx = c.displayField != null ? c.displayField : (3 + j);
      const v = r[idx];
      return `<td>${v == null ? '' : String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</td>`;
    }).join('');
    return `<tr><td>${id}</td><td>${nome}</td>${tds}<td><button class="button ghost" data-edit="${id}">Editar</button>${cfg.apiExcluir ? ` <button class="button danger" data-excluir="${id}" data-nome="${nome}">Excluir</button>` : ''}</td></tr>`;
  }).join('') : '';
  const headers = ['ID', cfg.campos[0].label, ...cfg.campos.slice(1).map(c => c.label), ''];
  app.innerHTML = `<span class="eyebrow">CADASTROS</span><h1>${cfg.titulo}</h1><p class="subtitle">Cada cliente pode criar, editar e inativar os proprios ${cfg.titulo.toLowerCase()}.</p><div class="toolbar"><div></div><button class="button" id="novo">Novo</button></div><div class="panel"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>${!lista.length ? '<div class="empty"><div class="icon">◌</div>Nenhum cadastro.</div>' : ''}</div>`;
  document.getElementById('novo').onclick = () => formCadastro(tipo, contextoId, api, null);
  document.querySelectorAll('button[data-edit]').forEach(btn => btn.onclick = () => {
    const id = Number(btn.dataset.edit);
    const item = lista.find(r => r[0] === id);
    formCadastro(tipo, contextoId, api, item);
  });
  document.querySelectorAll('button[data-excluir]').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.excluir);
      const nome = btn.dataset.nome;
      if (!confirm(`Excluir "${nome}"?\n\nSe houver dados vinculados (lancamentos, etc), sera necessario confirmar o cascade (apagar tudo junto).`)) return;
      try {
        api(cfg.apiExcluir, { id });
        if (globalThis.toastOk) toastOk(`"${nome}" excluido.`);
        renderCadastroGenerico(tipo, contextoId, api);
      } catch (e) {
        if (confirm(`${e.message}\n\nApagar TUDO em cascata (lancamentos vinculados, etc)? ESTA ACAO E IRREVERSIVEL.`)) {
          try {
            api(cfg.apiExcluir, { id, cascade: true });
            if (globalThis.toastOk) toastOk(`"${nome}" e dados vinculados foram excluidos.`);
            renderCadastroGenerico(tipo, contextoId, api);
          } catch (e2) {
            if (globalThis.toastErr) toastErr('Erro: ' + e2.message);
          }
        }
      }
    };
  });
}

function formCadastro(tipo, contextoId, api, item) {
  const cfg = MAPA[tipo];
  const app = document.getElementById('app');
  // v0.12.3: para edicao, o item vem do listarProjetos com shape customizado
  // (cliente_id em r[3], cliente_nome em r[4]). Pra mapear pros campos do form,
  // uso cfg.campos[i].nome pra encontrar a posicao no array.
  // O map nome -> indice depende do shape do SELECT: aqui assumimos
  // (a) campos[0].nome esta em r[2]
  // (b) campos[i].nome (i>=1) esta em r[3 + (i-1)], EXCETO se displayField estiver setado
  //     (nesses casos, o valor real vem de r[3 + (i-1)] e displayField eh so pra tabela)
  const values = {};
  if (item) {
    for (let i = 0; i < cfg.campos.length; i++) {
      const c = cfg.campos[i];
      const idx = i === 0 ? 2 : (3 + (i - 1));
      values[c.nome] = item[idx] ?? '';
    }
  }
  const inputs = cfg.campos.map(c => {
    const v = values[c.nome] ?? '';
    if (c.tipo === 'cor') return `<label>${c.label}<input type="color" name="${c.nome}" value="${v || '#155e6f'}"></label>`;
    if (c.tipo === 'select') {
      // v0.12.3: render <select> com options carregadas
      const opts = carregarSelectOptions(api, c.selectApi, contextoId);
      const optVazio = c.selectVazio ? `<option value="">${c.selectVazio}</option>` : '';
      const optItems = opts.map((o) => {
        const val = o[c.selectValue ?? 0];
        const text = String(o[c.selectLabel ?? 2] ?? '').replaceAll('"', '&quot;');
        return `<option value="${val}" ${String(val) === String(v) ? 'selected' : ''}>${text}</option>`;
      }).join('');
      return `<label>${c.label}${c.required ? ' *' : ''}<select name="${c.nome}">${optVazio}${optItems}</select></label>`;
    }
    return `<label>${c.label}${c.required ? ' *' : ''}<input name="${c.nome}" value="${v}" ${c.required ? 'required' : ''}></label>`;
  }).join('');
  app.innerHTML = `<div class="panel"><h1>${item ? 'Editar' : 'Novo'} ${cfg.titulo.slice(0, -1).toLowerCase()}</h1><form id="form"><div class="form-grid">${inputs}</div><div class="form-actions"><button type="button" class="button secondary" id="cancel">Cancelar</button><button class="button">Salvar</button></div></form></div>`;
  document.getElementById('cancel').onclick = () => renderCadastroGenerico(tipo, contextoId, api);
  document.getElementById('form').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const dados = { contextoId };
    for (const c of cfg.campos) {
      const v = f.get(c.nome);
      if (c.tipo === 'select') {
        // v0.12.3: select vazio vira null, senao converte pra int
        dados[c.nome] = (v === '' || v == null) ? null : Number(v);
      } else if (v != null && v !== '') {
        dados[c.nome] = v;
      }
    }
    try {
      if (item) { api(cfg.apiAtualizar, { id: item[0], ...dados }); }
      else { api(cfg.apiCriar, dados); }
      const msg = item ? 'Cadastro atualizado.' : 'Cadastro criado.';
      if (globalThis.toastOk) toastOk(msg);
      renderCadastroGenerico(tipo, contextoId, api);
    } catch (err) {
      if (globalThis.toastErr) toastErr('Erro: ' + err.message);
    }
  };
}
