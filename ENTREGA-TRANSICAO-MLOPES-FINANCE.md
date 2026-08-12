# Entrega de transição — MLopes Finance

Data de consolidação: 11 de agosto de 2026  
Situação: projeto em fundação; **não aprovado para uso ou comercialização**.

## 1. Objetivo do produto

Construir o **MLopes Finance**, aplicativo Windows 10/11, local-first e comercializável, para gestão financeira pessoal e empresarial. O produto não pode trazer empresas, bancos, categorias ou clientes fixos como regra de sistema: todos são cadastros editáveis por instalação.

A configuração inicial desejada pelo proprietário contém dois contextos independentes — Pessoal e ML Lopes Design —, mas essa configuração é apenas exemplo inicial. O cliente final deve poder criar, editar, desativar e organizar seus próprios contextos financeiros.

## 2. Decisões de produto já aprovadas

| Área | Decisão |
| --- | --- |
| Entrada de lançamentos | Manual e importação OFX/CSV |
| Tipos de conta | Conta bancária, cartão de crédito e investimento |
| Cartões | Fatura por ciclo, compras parceladas, limite total, usado, disponível e comprometimento futuro |
| Classificação | Cliente, projeto, categoria, centro de custo, tags, documento/anexo e observações; campos opcionais conforme cada lançamento |
| Comercial | Fluxo completo: orçamento/proposta → aprovação → contrato/recorrência → contas a receber → recebimentos parciais/totais → baixa → conciliação |
| Fiscal | Módulo opcional, desligado por padrão. Deve permitir registro de nota emitida externamente desde o início. Integração NFS-e futura, configurável por município, regime e certificado, sem bloquear o financeiro |
| Produto comercial | Nenhuma empresa, conta, banco, categoria, cidade ou prefeitura fixa no código, banco, tela, relatório ou documentação operacional |

## 3. Regras arquiteturais obrigatórias

1. Regra de negócio em `src/js/backend/core/`, sem DOM, `window` ou Neutralino.
2. Interface só acessa regra de negócio pela API única do backend; autorização fica no backend.
3. Toda linha financeira pertence obrigatoriamente a um contexto financeiro.
4. Valores monetários usam inteiros em centavos; datas operacionais usam `YYYY-MM-DD`.
5. Lançamento conciliado não pode ser apagado nem alterado; correção deve criar estorno ou ajuste auditável.
6. Persistência do SQLite precisa usar: `tmp → atual.old → tmp para atual → remove old`; nunca remover o arquivo atual antes de o substituto estar pronto.
7. Migrações precisam ser idempotentes e testadas contra um banco anterior real.
8. Cada build exige aumento de versão, testes, documentação, mapa técnico e histórico atualizados.
9. Após a primeira distribuição comercial, `applicationId`, nome do binário, caminho de dados e nome do banco tornam-se imutáveis.

## 4. Arquitetura pretendida

| Item | Definição |
| --- | --- |
| Plataforma | Windows 10/11 |
| Cliente | JavaScript ES modules puro, HTML e CSS, sem framework de front-end |
| Contêiner desktop | Neutralino 6 + WebView2 |
| Banco local | SQLite em `%APPDATA%/MLopesFinance/dados/mlopes-finance.sqlite` |
| Sincronização futura | Exclusivamente por API; o desktop nunca acessa banco remoto diretamente |
| Atualização | Releases versionadas, backup obrigatório antes da atualização, salvamento do banco antes do reinício |

## 5. Domínio financeiro mínimo

Entidades previstas: `contextos_financeiros`, `contas`, `cartoes`, `faturas`, `clientes`, `projetos`, `categorias`, `centros_custo`, `lancamentos`, `parcelas`, `baixas`, `importacoes`, `itens_importacao`, `conciliacoes`, `anexos` e `auditoria`.

Invariantes:

- Um lançamento exige contexto, conta, natureza, valor positivo em centavos e data de competência.
- Transferência gera débito e crédito vinculados no mesmo contexto.
- Baixa parcial não pode ultrapassar o valor aberto.
- Compra parcelada cria previsões futuras vinculadas e não altera parcela já liquidada.
- Importação oferece prévia, requer confirmação explícita e deve impedir reimportação da mesma origem.
- Conciliação é reversível e auditada.

## 6. Código existente no diretório entregue

Há uma fundação em JavaScript com estes pontos principais:

| Caminho | Conteúdo atual |
| --- | --- |
| `src/index.html`, `src/css/app.css`, `src/js/app.js` | Interface inicial |
| `src/js/backend/servidor.js` | Porta de API `processar(canal, dados)` |
| `src/js/backend/core/financeiro.js` e `lancamentos.js` | Regras de lançamentos, baixas, transferências e parcelas |
| `src/js/backend/db.js` | Persistência com sql.js e rotina de arquivo seguro |
| `src/js/backend/schema.sql` e `migracoes.js` | Schema e migrações |
| `tests/*.test.mjs` | Testes do núcleo e das migrações |
| `tools/check.mjs`, `tools/graphify.mjs` | Verificações e geração do mapa técnico |
| `scripts/build-portable.mjs`, `scripts/build-installer.mjs`, `installer/MLopesFinance.nsi` | Tentativa de empacotamento Windows |
| `docs/` | Especificação, manual e guia rápido iniciais |

Também há diretórios duplicados (`resources/`, `temp/`, `build/staging/` e `portable/`) produzidos durante tentativas de build. Eles não devem ser tratados como fonte de verdade sem uma limpeza e reorganização antes da continuidade.

## 7. Estado real e bloqueio atual

O instalador `v0.3.2` **não está aprovado**.

Evidência: após a instalação, o executável abriu a página padrão do Neutralino (“Build lightweight cross-platform desktop apps…”), e não a interface do MLopes Finance. Portanto, o aplicativo está iniciando o contêiner, mas os recursos do produto não estão sendo carregados corretamente.

Não usar ou distribuir os arquivos atuais em `release/` como versão do produto.

Há duas falhas de processo que precisam ser corrigidas antes de qualquer nova entrega:

1. O pacote foi validado apenas por presença de arquivos e marcadores, sem teste visual/funcional em Windows do executável instalado.
2. O script de build cria `res.neu` com `asar.createPackage(...)`. Isso precisa ser substituído ou comprovadamente compatibilizado com o formato oficial esperado pelo Neutralino 6; a imagem recebida demonstra que a validação atual não assegura o carregamento dos recursos do aplicativo.

## 8. Pendências para uma versão instalável verdadeira

1. Reestruturar o build a partir do fluxo oficial do Neutralino 6, mantendo uma única fonte para recursos e configuração.
2. Empacotar e testar no Windows a partir de uma instalação limpa: abrir pelo atalho, abrir pelo menu Iniciar, fechar e reabrir; validar que a tela exibida é o MLopes Finance.
3. Validar em máquina com WebView2 Runtime presente e documentar o requisito quando for necessário.
4. Implementar e testar integralmente: cartões/faturas/parcelas, investimentos, OFX, CSV configurável, conciliação, recorrências, anexos, auditoria, contas a pagar/receber, comercial e relatórios.
5. Implementar permissões e perfis no backend antes de qualquer modo multiusuário ou sincronização.
6. Definir backup/exportação/restauração com teste de conteúdo, não apenas abertura do arquivo.
7. Criar repositório Git remoto; o diretório atual não possui repositório Git configurado, portanto não existe histórico de commits confiável.
8. Só publicar novo instalador após teste automático, teste de migração sobre banco antigo e teste manual documentado do pacote instalado.

## 9. Ordem de execução recomendada

1. Corrigir a cadeia oficial de build e criar uma prova de abertura da interface correta.
2. Consolidar a estrutura de diretórios e eliminar duplicidades geradas por build.
3. Revisar schema, migrações, núcleo e testes contra os requisitos deste documento.
4. Implementar cadastros e financeiro básico completos.
5. Implementar cartões, investimentos, importação e conciliação.
6. Implementar comercial, previsões e relatórios.
7. Fechar backup, restauração, auditoria, atualização, documentação e instalador.
8. Desenvolver fiscal como módulo separado, após o núcleo financeiro estar estável.

## 10. Critérios de aceite da primeira versão comercial

- Instalador Windows real instala, abre a interface do MLopes Finance e funciona após reinício.
- Dados ficam fora da pasta do programa e sobrevivem à atualização/desinstalação.
- Todos os recursos obrigatórios desta especificação funcionam sem nomes fixos de empresas.
- Importação não grava sem prévia/confirmação e impede duplicidade.
- Valores, transferências, baixas, parcelas e conciliação preservam todas as invariantes acima.
- Testes automatizados e testes de migração passam em ambiente limpo.
- Manual, guia rápido, mapa técnico, histórico de versões, hash e notas de release correspondem exatamente ao instalador entregue.

## 11. Referências no diretório

- `AGENTS.md` — regras do projeto.
- `docs/ESPECIFICACAO-FUNCIONAL.md` — escopo inicial.
- `GRAPHIFY.md` — mapa técnico gerado da fundação atual.
- `HISTORICO-DE-VERSOES.md` — histórico das tentativas de entrega; a versão 0.3.2 precisa ser tratada como reprovada pelo defeito registrado na seção 7.

