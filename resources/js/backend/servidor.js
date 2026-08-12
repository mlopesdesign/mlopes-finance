import { criarCategoria, criarConta, criarContexto } from './core/financeiro.js';
import { conciliarLancamento, criarLancamento, resumo } from './core/lancamentos.js';
import { getAllConfig, getConfig, setConfig, deleteConfig, resetConfig } from './core/configuracoes.js';

export function criarApi(db, persistir = () => {}) {
  const rotas = {
    'contextos:listar': () => db.exec('SELECT * FROM contextos_financeiros WHERE ativo = 1 ORDER BY nome')[0]?.values ?? [],
    'contextos:criar': (d) => { const id = criarContexto(db, d); persistir(); return id; },
    'contas:listar': (d) => db.exec('SELECT * FROM contas WHERE contexto_id = ? AND ativo = 1 ORDER BY nome', [d.contextoId])[0]?.values ?? [],
    'contas:criar': (d) => { const id = criarConta(db, d); persistir(); return id; },
    'categorias:listar': (d) => db.exec('SELECT * FROM categorias WHERE contexto_id = ? AND ativo = 1 ORDER BY nome', [d.contextoId])[0]?.values ?? [],
    'categorias:criar': (d) => { const id = criarCategoria(db, d); persistir(); return id; },
    'lancamentos:listar': (d) => db.exec(`SELECT l.*, c.nome conta_nome, ca.nome categoria_nome FROM lancamentos l JOIN contas c ON c.id = l.conta_id LEFT JOIN categorias ca ON ca.id = l.categoria_id WHERE l.contexto_id = ? ORDER BY l.data_competencia DESC, l.id DESC`, [d.contextoId])[0]?.values ?? [],
    'lancamentos:criar': (d) => { const id = criarLancamento(db, d); persistir(); return id; },
    'lancamentos:conciliar': (d) => { const out = conciliarLancamento(db, d.id); persistir(); return out; },
    'dashboard:resumo': (d) => resumo(db, d.contextoId),
    'configuracoes:listar': () => getAllConfig(db),
    'configuracoes:obter': (d) => getConfig(db, d.chave),
    'configuracoes:salvar': (d) => { const out = setConfig(db, d.chave, d.valor, d.tipo || 'texto'); persistir(); return out; },
    'configuracoes:excluir': (d) => { const out = deleteConfig(db, d.chave); persistir(); return out; },
    'configuracoes:resetar': () => { const out = resetConfig(db); persistir(); return out; },
  };
  return (canal, dados = {}) => { if (!rotas[canal]) throw new Error(`Canal não autorizado: ${canal}`); return rotas[canal](dados); };
}
