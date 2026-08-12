PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS contextos_financeiros (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contas (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('bancaria','cartao','investimento')),
  saldo_inicial_centavos INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  nome TEXT NOT NULL,
  natureza TEXT NOT NULL CHECK (natureza IN ('receita','despesa','ambas')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contexto_id, nome)
);

CREATE TABLE IF NOT EXISTS lancamentos (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  conta_id INTEGER NOT NULL REFERENCES contas(id),
  categoria_id INTEGER REFERENCES categorias(id),
  cliente_id INTEGER REFERENCES clientes(id),
  projeto_id INTEGER REFERENCES projetos(id),
  centro_custo_id INTEGER REFERENCES centros_custo(id),
  natureza TEXT NOT NULL CHECK (natureza IN ('receita','despesa','transferencia')),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  data_competencia TEXT NOT NULL CHECK (data_competencia GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  data_vencimento TEXT CHECK (data_vencimento GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR data_vencimento IS NULL),
  descricao TEXT NOT NULL,
  observacoes TEXT NOT NULL DEFAULT '',
  transferencia_id INTEGER REFERENCES transferencias(id),
  status TEXT NOT NULL CHECK (status IN ('aberto','conciliado','estornado')),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT
);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY,
  entidade TEXT NOT NULL,
  entidade_id INTEGER NOT NULL,
  acao TEXT NOT NULL,
  dados_json TEXT NOT NULL,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('texto','numero','cor','booleano','arquivo')) DEFAULT 'texto',
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  nome TEXT NOT NULL,
  documento TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT
);

CREATE TABLE IF NOT EXISTS fornecedores (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  nome TEXT NOT NULL,
  documento TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT
);

CREATE TABLE IF NOT EXISTS projetos (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  cliente_id INTEGER REFERENCES clientes(id),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  data_inicio TEXT,
  data_fim TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT
);

CREATE TABLE IF NOT EXISTS centros_custo (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT,
  UNIQUE(contexto_id, nome)
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#155e6f',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contexto_id, nome)
);

CREATE TABLE IF NOT EXISTS lancamento_tags (
  lancamento_id INTEGER NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lancamento_id, tag_id)
);

CREATE TABLE IF NOT EXISTS transferencias (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  lancamento_origem_id INTEGER NOT NULL REFERENCES lancamentos(id),
  lancamento_destino_id INTEGER NOT NULL REFERENCES lancamentos(id),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  data_transferencia TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS baixas (
  id INTEGER PRIMARY KEY,
  lancamento_id INTEGER NOT NULL REFERENCES lancamentos(id),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  data_baixa TEXT NOT NULL,
  forma_pagamento TEXT NOT NULL DEFAULT 'dinheiro',
  observacoes TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recorrencias (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  lancamento_template_id INTEGER NOT NULL REFERENCES lancamentos(id),
  periodicidade TEXT NOT NULL CHECK (periodicidade IN ('diaria','semanal','mensal','bimestral','trimestral','semestral','anual')),
  total_ocorrencias INTEGER,
  ativa INTEGER NOT NULL DEFAULT 1,
  proxima_geracao TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cartoes (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  nome TEXT NOT NULL,
  instituicao TEXT NOT NULL DEFAULT '',
  limite_centavos INTEGER NOT NULL DEFAULT 0,
  dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  conta_pagamento_id INTEGER REFERENCES contas(id),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT
);

CREATE TABLE IF NOT EXISTS faturas (
  id INTEGER PRIMARY KEY,
  cartao_id INTEGER NOT NULL REFERENCES cartoes(id),
  ciclo TEXT NOT NULL,
  data_fechamento TEXT NOT NULL,
  data_vencimento TEXT NOT NULL,
  valor_total_centavos INTEGER NOT NULL DEFAULT 0,
  valor_pago_centavos INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('aberta','fechada','paga','vencida')) DEFAULT 'aberta',
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT,
  UNIQUE(cartao_id, ciclo)
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_contexto_data ON lancamentos(contexto_id, data_competencia);
CREATE INDEX IF NOT EXISTS idx_baixas_lancamento ON baixas(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_clientes_contexto ON clientes(contexto_id, nome);
CREATE INDEX IF NOT EXISTS idx_fornecedores_contexto ON fornecedores(contexto_id, nome);
CREATE INDEX IF NOT EXISTS idx_projetos_contexto ON projetos(contexto_id, nome);
CREATE INDEX IF NOT EXISTS idx_centros_custo_contexto ON centros_custo(contexto_id, nome);
CREATE INDEX IF NOT EXISTS idx_tags_contexto ON tags(contexto_id, nome);
CREATE INDEX IF NOT EXISTS idx_faturas_cartao ON faturas(cartao_id, ciclo);

CREATE TABLE IF NOT EXISTS importacoes (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  arquivo_origem TEXT NOT NULL,
  formato TEXT NOT NULL CHECK (formato IN ('ofx','csv')),
  hash_arquivo TEXT NOT NULL,
  total_registros INTEGER NOT NULL DEFAULT 0,
  total_importados INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('previa','confirmada','cancelada','erro')) DEFAULT 'previa',
  mapeamento_csv TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itens_importacao (
  id INTEGER PRIMARY KEY,
  importacao_id INTEGER NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
  conta_id INTEGER REFERENCES contas(id),
  data_transacao TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  chave_externa TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendente','importado','ignorado','duplicado')) DEFAULT 'pendente',
  lancamento_id INTEGER REFERENCES lancamentos(id),
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(importacao_id, chave_externa)
);

CREATE TABLE IF NOT EXISTS anexos (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  lancamento_id INTEGER REFERENCES lancamentos(id) ON DELETE SET NULL,
  nome_arquivo TEXT NOT NULL,
  caminho TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'application/octet-stream',
  tamanho INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conciliacoes (
  id INTEGER PRIMARY KEY,
  contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
  conta_id INTEGER NOT NULL REFERENCES contas(id),
  data_inicio TEXT NOT NULL,
  data_fim TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('em_andamento','finalizada','cancelada')) DEFAULT 'em_andamento',
  lancamentos_conciliados INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalizado_em TEXT
);

CREATE INDEX IF NOT EXISTS idx_importacoes_contexto ON importacoes(contexto_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_itens_importacao_status ON itens_importacao(importacao_id, status);
CREATE INDEX IF NOT EXISTS idx_itens_importacao_chave ON itens_importacao(chave_externa);
CREATE INDEX IF NOT EXISTS idx_anexos_lancamento ON anexos(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_conciliacoes_conta ON conciliacoes(conta_id, data_inicio);
