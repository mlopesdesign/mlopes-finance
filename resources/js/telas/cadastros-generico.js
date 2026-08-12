// MLopes Finance — tela generica para cadastros (clientes, fornecedores, projetos, centros_custo, tags, contas, categorias)
// Reaproveita o mesmo padrao de lista + form.

const MAPA = {
  clientes: { titulo: 'Clientes', apiListar: 'clientes:listar', apiCriar: 'clientes:criar', apiAtualizar: 'clientes:atualizar', campos: [
    { nome: 'nome', label: 'Nome', tipo: 'texto', required: true },
    { nome: 'documento', label: 'Documento (CPF/CNPJ)', tipo: 'texto' },
    { nome: 'email', label: 'E-mail', tipo: 'texto' },
    { nome: 'telefone', label: 'Telefone', tipo: 'texto' },
    { nome: 'observacoes', label: 'Observacoes', tipo: 'texto' },
  ]},
  fornecedores: { titulo: 'Fornecedores', apiListar: 'fornecedores:listar', apiCriar: 'fornecedores:criar', apiAtualizar: 'fornecedores:atualizar', campos: [
    { nome: 'nome', label: 'Nome', tipo: 'texto', required: true },
    { nome: 'documento', label: 'Documento (CPF/CNPJ)', tipo: 'texto' },
    { nome: 'observacoes', label: 'Observacoes', tipo: 'texto' },
  ]},
  projetos: { titulo: 'Projetos', apiListar: 'projetos:listar', apiCriar: 'projetos:criar', campos: [
    { nome: 'nome', label: 'Nome', tipo: 'texto', required: true },
    { nome: 'descricao', label: 'Descricao', tipo: 'texto' },
    { nome: 'dataInicio', label: 'Data inicio (YYYY-MM-DD)', tipo: 'texto' },
    { nome: 'dataFim', label: 'Data fim (YYYY-MM-DD)', tipo: 'texto' },
  ]},
  centros_custo: { titulo: 'Centros de custo', apiListar: 'centros_custo:listar', apiCriar: 'centos_custo:criar', campos: [
    { nome: 'nome', label: 'Nome', tipo: 'texto', required: true },
    { nome: 'descricao', label: 'Descricao', tipo: 'texto' },
  ]},
  tags: { titulo: 'Tags', apiListar: 'tags:listar', apiCriar: 'tags:criar', campos: [
    { nome: 'nome', label: 'Nome', tipo: 'texto', required: true },
    { nome: 'cor', label: 'Cor', tipo: 'cor' },
  ]},
};

export function renderCadastroGenerico(tipo, contextoId, api) {
  const cfg = MAPA[tipo];
  if (!cfg) throw new Error(`Cadastro generico nao configurado para ${tipo}`);
  const app = document.getElementById('app');
  const lista = api(cfg.apiListar, { contextoId });
  const rows = lista.length ? lista.map((r, i) => `<tr><td>${r[0]}</td><td>${r[2] || ''}</td>${cfg.campos.slice(1).map((_, j) => `<td>${r[3 + j] || ''}</td>`).join('')}<td><button class="button ghost" data-edit="${r[0]}">Editar</button></td></tr>`).join('') : '';
  const headers = ['ID', cfg.campos[0].label, ...cfg.campos.slice(1).map(c => c.label), ''];
  app.innerHTML = `<span class="eyebrow">CADASTROS</span><h1>${cfg.titulo}</h1><p class="subtitle">Cada cliente pode criar, editar e inativar os proprios ${cfg.titulo.toLowerCase()}.</p><div class="toolbar"><div></div><button class="button" id="novo">Novo</button></div><div class="panel"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>${!lista.length ? '<div class="empty"><div class="icon">◌</div>Nenhum cadastro.</div>' : ''}</div>`;
  document.getElementById('novo').onclick = () => formCadastro(tipo, contextoId, api, null);
  document.querySelectorAll('button[data-edit]').forEach(btn => btn.onclick = () => {
    const id = Number(btn.dataset.edit);
    const item = lista.find(r => r[0] === id);
    formCadastro(tipo, contextoId, api, item);
  });
}

function formCadastro(tipo, contextoId, api, item) {
  const cfg = MAPA[tipo];
  const app = document.getElementById('app');
  const values = item ? Object.fromEntries(cfg.campos.map((c, i) => [c.nome, item[2 + i] ?? ''])) : {};
  const inputs = cfg.campos.map(c => {
    const v = values[c.nome] ?? '';
    if (c.tipo === 'cor') return `<label>${c.label}<input type="color" name="${c.nome}" value="${v || '#155e6f'}"></label>`;
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
      if (v != null && v !== '') dados[c.nome] = v;
    }
    try {
      if (item) { api(cfg.apiAtualizar, { id: item[0], ...dados }); }
      else { api(cfg.apiCriar, dados); }
      renderCadastroGenerico(tipo, contextoId, api);
    } catch (err) { alert('Erro: ' + err.message); }
  };
}
