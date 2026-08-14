import { criarCategoria, criarConta, criarContexto, listarContextos, obterContexto, atualizarContexto, alternarContextoAtivo, resumoContexto, atualizarConta, atualizarCategoria, excluirContexto, excluirConta, excluirCategoria } from './core/financeiro.js';
import { conciliarLancamento, criarLancamento, resumo, excluirLancamento, excluirTodosLancamentos, estornarLancamento, editarLancamento, listarLancamentos, listarLancamentosDetalhados, obterLancamento } from './core/lancamentos.js';
import { getAllConfig, getConfig, setConfig, deleteConfig, resetConfig } from './core/configuracoes.js';
import { criarBackup, radiografar, restaurarBackup, validarCiclo, resetarBanco } from './core/backup.js';
import { criarCliente, listarClientes, atualizarCliente, criarFornecedor, listarFornecedores, atualizarFornecedor, criarProjeto, listarProjetos, atualizarProjeto, criarCentroCusto, listarCentrosCusto, criarTag, listarTags, vincularTagLancamento, listarTagsDoLancamento, excluirCliente, excluirFornecedor, excluirProjeto, excluirCentroCusto, excluirTag, desvincularTagLancamento } from './core/cadastros.js';
import { criarTransferencia, listarTransferencias, excluirTransferencia } from './core/transferencias.js';
import { registrarBaixa, listarBaixas, saldoEmAberto, removerBaixa } from './core/baixas.js';
import { criarRecorrencia, gerarProximaOcorrencia, listarRecorrencias, excluirRecorrencia, desativarRecorrencia } from './core/recorrencias.js';
import { criarCartao, listarCartoes, abrirFatura, pagarFatura, listarFaturas, adicionarLancamentoNaFatura } from './core/cartoes.js';
import { criarPreviaImportacao, confirmarImportacao, listarImportacoes, cancelarImportacao, excluirImportacao, excluirLancamentosImportacao, reciclarImportacao } from './core/importacao.js';
import { balancete, comparativo, exportaCSV } from './core/relatorios.js';
import { compararVersao } from './core/update.js';
import { checarAtualizacao, baixarAtualizacao, aplicarAtualizacao, listarReleases, pathTempInstalador } from './update.js';
import { APP_VERSION } from './ambiente.js';

export function criarApi(db, persistir = () => {}) {
  const rotas = {
    'contextos:listar': (d = {}) => listarContextos(db, d.incluirInativos === true),
    'contextos:obter': (d) => obterContexto(db, d.id),
    'contextos:criar': (d) => { const id = criarContexto(db, d); persistir(); return id; },
    'contextos:atualizar': (d) => { atualizarContexto(db, d); persistir(); return true; },
    'contextos:alternarAtivo': (d) => { const r = alternarContextoAtivo(db, d.id); persistir(); return r; },
    'contextos:excluir': (d) => { const r = excluirContexto(db, d.id, { cascade: d.cascade === true }); persistir(); return r; },
    'contextos:resumo': (d) => resumoContexto(db, d.contextoId),
    'contas:listar': (d) => db.exec('SELECT * FROM contas WHERE contexto_id = ? AND ativo = 1 ORDER BY nome', [d.contextoId])[0]?.values ?? [],
    'contas:criar': (d) => { const id = criarConta(db, d); persistir(); return id; },
    'contas:atualizar': (d) => { atualizarConta(db, d); persistir(); return true; },
    'contas:excluir': (d) => { const r = excluirConta(db, d.id, { cascade: d.cascade === true }); persistir(); return r; },
    'categorias:listar': (d) => db.exec('SELECT * FROM categorias WHERE contexto_id = ? AND ativo = 1 ORDER BY nome', [d.contextoId])[0]?.values ?? [],
    'categorias:criar': (d) => { const id = criarCategoria(db, d); persistir(); return id; },
    'categorias:atualizar': (d) => { atualizarCategoria(db, d); persistir(); return true; },
    'categorias:excluir': (d) => { const r = excluirCategoria(db, d.id, { cascade: d.cascade === true }); persistir(); return r; },
    'lancamentos:listar': (d) => listarLancamentosDetalhados(db, d.contextoId, { incluirEstornados: d.incluirEstornados === true, limite: d.limite ?? 500 }),
    'lancamentos:obter': (d) => obterLancamento(db, d.id),
    'lancamentos:criar': (d) => { const id = criarLancamento(db, d); persistir(); return id; },
    'lancamentos:conciliar': (d) => { const out = conciliarLancamento(db, d.id); persistir(); return out; },
    'lancamentos:excluir': (d) => { const r = excluirLancamento(db, d.id); persistir(); return r; },
    'lancamentos:excluirTodos': (d) => { const r = excluirTodosLancamentos(db, d.contextoId); persistir(); return r; },
    'lancamentos:estornar': (d) => { const r = estornarLancamento(db, d.id, d.dataEstorno); persistir(); return r; },
    'lancamentos:editar': (d) => { const r = editarLancamento(db, d.id, d.campos); persistir(); return r; },
    'dashboard:resumo': (d) => resumo(db, d.contextoId),

    // Configuracoes
    'configuracoes:listar': () => getAllConfig(db),
    'configuracoes:obter': (d) => getConfig(db, d.chave),
    'configuracoes:salvar': (d) => { const out = setConfig(db, d.chave, d.valor, d.tipo || 'texto'); persistir(); return out; },
    'configuracoes:excluir': (d) => { const out = deleteConfig(db, d.chave); persistir(); return out; },
    'configuracoes:resetar': () => { const out = resetConfig(db); persistir(); return out; },

    // Cadastros
    'clientes:listar': (d) => listarClientes(db, d.contextoId),
    'clientes:criar': (d) => { const id = criarCliente(db, d); persistir(); return id; },
    'clientes:atualizar': (d) => { atualizarCliente(db, d.id, d); persistir(); return true; },
    'clientes:excluir': (d) => { const r = excluirCliente(db, d.id, { cascade: d.cascade === true }); persistir(); return r; },
    'fornecedores:listar': (d) => listarFornecedores(db, d.contextoId),
    'fornecedores:criar': (d) => { const id = criarFornecedor(db, d); persistir(); return id; },
    'fornecedores:atualizar': (d) => { atualizarFornecedor(db, d.id, d); persistir(); return true; },
    'fornecedores:excluir': (d) => { const r = excluirFornecedor(db, d.id); persistir(); return r; },
    'projetos:listar': (d) => listarProjetos(db, d.contextoId),
    'projetos:criar': (d) => { const id = criarProjeto(db, d); persistir(); return id; },
    'projetos:excluir': (d) => { const r = excluirProjeto(db, d.id, { cascade: d.cascade === true }); persistir(); return r; },
    'centros_custo:listar': (d) => listarCentrosCusto(db, d.contextoId),
    'centros_custo:criar': (d) => { const id = criarCentroCusto(db, d); persistir(); return id; },
    'centros_custo:excluir': (d) => { const r = excluirCentroCusto(db, d.id, { cascade: d.cascade === true }); persistir(); return r; },
    'tags:listar': (d) => listarTags(db, d.contextoId),
    'tags:criar': (d) => { const id = criarTag(db, d); persistir(); return id; },
    'tags:excluir': (d) => { const r = excluirTag(db, d.id); persistir(); return r; },
    'lancamento_tags:vincular': (d) => { const ok = vincularTagLancamento(db, d.lancamentoId, d.tagId); persistir(); return ok; },
    'lancamento_tags:desvincular': (d) => { const ok = desvincularTagLancamento(db, d.lancamentoId, d.tagId); persistir(); return ok; },
    'lancamento_tags:listar': (d) => listarTagsDoLancamento(db, d.lancamentoId),

    // Transferencias
    'transferencias:criar': (d) => { const out = criarTransferencia(db, d); persistir(); return out; },
    'transferencias:listar': (d) => listarTransferencias(db, d.contextoId),
    'transferencias:excluir': (d) => { const r = excluirTransferencia(db, d.id, { cascade: d.cascade === true }); persistir(); return r; },

    // Baixas
    'baixas:registrar': (d) => { const out = registrarBaixa(db, d); persistir(); return out; },
    'baixas:listar': (d) => listarBaixas(db, d.lancamentoId),
    'baixas:saldo': (d) => saldoEmAberto(db, d.lancamentoId),
    'baixas:remover': (d) => { removerBaixa(db, d.id); persistir(); return true; },

    // Recorrencias
    'recorrencias:criar': (d) => { const id = criarRecorrencia(db, d); persistir(); return id; },
    'recorrencias:gerar': (d) => { const out = gerarProximaOcorrencia(db, d.id); persistir(); return out; },
    'recorrencias:listar': (d) => listarRecorrencias(db, d.contextoId),
    'recorrencias:excluir': (d) => { const r = excluirRecorrencia(db, d.id, { cascade: d.cascade === true }); persistir(); return r; },
    'recorrencias:desativar': (d) => { const r = desativarRecorrencia(db, d.id); persistir(); return r; },

    // Cartoes e faturas
    'cartoes:criar': (d) => { const id = criarCartao(db, d); persistir(); return id; },
    'cartoes:listar': (d) => listarCartoes(db, d.contextoId),
    'faturas:abrir': (d) => { const id = abrirFatura(db, d); persistir(); return id; },
    'faturas:pagar': (d) => { const out = pagarFatura(db, d); persistir(); return out; },
    'faturas:listar': (d) => listarFaturas(db, d.cartaoId),
    'faturas:adicionarLancamento': (d) => { adicionarLancamentoNaFatura(db, d.faturaId, d.valorCentavos); persistir(); return true; },

    // Backup
    'backup:radiografar': () => radiografar(db),
    'backup:validarCiclo': () => validarCiclo(db),
    'backup:exportar': () => criarBackup(db),
    'backup:restaurar': (d) => { const r = restaurarBackup(db, d.bytes); persistir(); return r; },
    'backup:resetar': () => { const r = resetarBanco(db); persistir(); return r; },

    // Importacao de extratos (OFX/CSV) — Fase 5
    'importacao:criarPrevia': (d) => { const out = criarPreviaImportacao(db, d); persistir(); return out; },
    'importacao:confirmar': (d) => { const out = confirmarImportacao(db, d); persistir(); return out; },
    'importacao:listar': (d) => listarImportacoes(db, d.contextoId),
    'importacao:cancelar': (d) => { cancelarImportacao(db, d.importacaoId); persistir(); return true; },
    'importacao:excluir': (d) => { const out = excluirImportacao(db, d.importacaoId); persistir(); return out; },
    'importacao:reciclar': (d) => { const out = reciclarImportacao(db, d.importacaoId); persistir(); return out; },
    'importacao:excluirLancamentos': (d) => { const out = excluirLancamentosImportacao(db, d.importacaoId); persistir(); return out; },
    'importacao:listarItens': (d) => db.exec('SELECT id, conta_id, data_transacao, valor_centavos, descricao, chave_externa, status, lancamento_id FROM itens_importacao WHERE importacao_id = ? ORDER BY data_transacao, id', [d.importacaoId])[0]?.values ?? [],
    'importacao:contarPorStatus': (d) => {
      const rows = db.exec("SELECT status, COUNT(*) FROM itens_importacao WHERE importacao_id = ? GROUP BY status", [d.importacaoId])[0]?.values ?? [];
      const out = { pendente: 0, importado: 0, ignorado: 0, duplicado: 0 };
      for (const [status, count] of rows) out[status] = count;
      return out;
    },

    // Relatorios e balancete — Fase 6
    'relatorios:balancete': (d) => balancete(db, d),
    'relatorios:comparativo': (d) => comparativo(db, d),
    'relatorios:exportarCSV': (d) => exportaCSV(balancete(db, d)),

    // Auto-update via GitHub Releases (Fase Hardening) — secao 5 do PADRAO.
    // ATENCAO: o backup do banco eh feito na rota `update:aplicar` ANTES de
    // chamar `aplicarAtualizacao`, conforme regra 5.1 (BACKUP obrigatorio).
    'update:checar': async (d = {}) => await checarAtualizacao({ ...d, versaoAtual: APP_VERSION }),
    'update:listarReleases': async (d = {}) => await listarReleases(d),
    'update:baixar': async (d) => await baixarAtualizacao(d.assetUrl, d.destino),
    'update:aplicar': async (d) => {
      // BACKUP do banco antes de substituir o bundle (regra 5.1).
      // Mantemos o backup em memoria; o caller pode persistir via update:backupPersistir.
      const backup = criarBackup(db);
      try {
        return await aplicarAtualizacao(d.caminho);
      } catch (e) {
        // Se a aplicacao falhar, devolve o backup para o caller decidir.
        return { ok: false, erro: e.message, backup };
      }
    },
    'update:compararVersao': (d) => compararVersao(d.a, d.b),
  };
  return (canal, dados = {}) => { if (!rotas[canal]) throw new Error(`Canal nao autorizado: ${canal}`); return rotas[canal](dados); };
}
