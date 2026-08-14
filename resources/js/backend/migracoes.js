export function migrar(db) {
  db.run('CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)');
  const current = db.exec("SELECT valor FROM meta WHERE chave = 'schema_version'")[0]?.values[0]?.[0] ?? '0';
  let destino = Number(current) || 0;
  if (destino < 1) {
    db.run("INSERT OR REPLACE INTO meta (chave, valor) VALUES ('schema_version', '1')");
    destino = 1;
  }
  if (destino < 2) {
    db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('texto','numero','cor','booleano','arquivo')) DEFAULT 'texto',
      atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const defaults = [['tema', 'dark', 'texto'], ['marca_cor', '#155e6f', 'cor'], ['nome_exibicao', 'MLopes Finance', 'texto'], ['moeda', 'BRL', 'texto'], ['locale', 'pt-BR', 'texto']];
    for (const [chave, valor, tipo] of defaults) {
      db.run(`INSERT OR IGNORE INTO configuracoes (chave, valor, tipo) VALUES (?, ?, ?)`, [chave, valor, tipo]);
    }
    db.run("INSERT OR REPLACE INTO meta (chave, valor) VALUES ('schema_version', '2')");
    destino = 2;
  }
  if (destino < 3) {
    // v0.5.0 — cadastros, transferencias, baixas, recorrencias, cartoes, faturas
    const tabelasV3 = [
      `CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
        nome TEXT NOT NULL, documento TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
        telefone TEXT NOT NULL DEFAULT '', observacoes TEXT NOT NULL DEFAULT '',
        ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS fornecedores (
        id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
        nome TEXT NOT NULL, documento TEXT NOT NULL DEFAULT '', observacoes TEXT NOT NULL DEFAULT '',
        ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS projetos (
        id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
        cliente_id INTEGER REFERENCES clientes(id), nome TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '',
        data_inicio TEXT, data_fim TEXT, ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS centros_custo (
        id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
        nome TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '',
        ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT,
        UNIQUE(contexto_id, nome)
      )`,
      `CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
        nome TEXT NOT NULL, cor TEXT NOT NULL DEFAULT '#155e6f',
        ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(contexto_id, nome)
      )`,
      `CREATE TABLE IF NOT EXISTS lancamento_tags (
        lancamento_id INTEGER NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (lancamento_id, tag_id)
      )`,
      `CREATE TABLE IF NOT EXISTS transferencias (
        id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
        lancamento_origem_id INTEGER NOT NULL REFERENCES lancamentos(id),
        lancamento_destino_id INTEGER NOT NULL REFERENCES lancamentos(id),
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
        data_transferencia TEXT NOT NULL, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS baixas (
        id INTEGER PRIMARY KEY, lancamento_id INTEGER NOT NULL REFERENCES lancamentos(id),
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
        data_baixa TEXT NOT NULL, forma_pagamento TEXT NOT NULL DEFAULT 'dinheiro',
        observacoes TEXT NOT NULL DEFAULT '', criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS recorrencias (
        id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
        lancamento_template_id INTEGER NOT NULL REFERENCES lancamentos(id),
        periodicidade TEXT NOT NULL CHECK (periodicidade IN ('diaria','semanal','mensal','bimestral','trimestral','semestral','anual')),
        total_ocorrencias INTEGER, ativa INTEGER NOT NULL DEFAULT 1,
        proxima_geracao TEXT, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS cartoes (
        id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
        nome TEXT NOT NULL, instituicao TEXT NOT NULL DEFAULT '',
        limite_centavos INTEGER NOT NULL DEFAULT 0,
        dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
        dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
        conta_pagamento_id INTEGER REFERENCES contas(id),
        ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS faturas (
        id INTEGER PRIMARY KEY, cartao_id INTEGER NOT NULL REFERENCES cartoes(id),
        ciclo TEXT NOT NULL, data_fechamento TEXT NOT NULL, data_vencimento TEXT NOT NULL,
        valor_total_centavos INTEGER NOT NULL DEFAULT 0, valor_pago_centavos INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL CHECK (status IN ('aberta','fechada','paga','vencida')) DEFAULT 'aberta',
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT,
        UNIQUE(cartao_id, ciclo)
      )`,
    ];
    for (const sql of tabelasV3) db.run(sql);
    const indicesV3 = [
      'CREATE INDEX IF NOT EXISTS idx_baixas_lancamento ON baixas(lancamento_id)',
      'CREATE INDEX IF NOT EXISTS idx_clientes_contexto ON clientes(contexto_id, nome)',
      'CREATE INDEX IF NOT EXISTS idx_fornecedores_contexto ON fornecedores(contexto_id, nome)',
      'CREATE INDEX IF NOT EXISTS idx_projetos_contexto ON projetos(contexto_id, nome)',
      'CREATE INDEX IF NOT EXISTS idx_centros_custo_contexto ON centros_custo(contexto_id, nome)',
      'CREATE INDEX IF NOT EXISTS idx_tags_contexto ON tags(contexto_id, nome)',
      'CREATE INDEX IF NOT EXISTS idx_faturas_cartao ON faturas(cartao_id, ciclo)',
    ];
    for (const sql of indicesV3) db.run(sql);
    db.run("INSERT OR REPLACE INTO meta (chave, valor) VALUES ('schema_version', '3')");
    destino = 3;
  }
  if (destino < 4) {
    // v0.6.0 — importacao OFX/CSV, anexos, conciliacoes
    const tabelasV4 = [
      `CREATE TABLE IF NOT EXISTS importacoes (
        id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
        arquivo_origem TEXT NOT NULL,
        formato TEXT NOT NULL CHECK (formato IN ('ofx','csv')),
        hash_arquivo TEXT NOT NULL, total_registros INTEGER NOT NULL DEFAULT 0,
        total_importados INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL CHECK (status IN ('previa','confirmada','cancelada','erro')) DEFAULT 'previa',
        mapeamento_csv TEXT NOT NULL DEFAULT '',
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS itens_importacao (
        id INTEGER PRIMARY KEY, importacao_id INTEGER NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
        conta_id INTEGER NOT NULL REFERENCES contas(id), data_transacao TEXT NOT NULL,
        valor_centavos INTEGER NOT NULL, descricao TEXT NOT NULL, chave_externa TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pendente','importado','ignorado','duplicado')) DEFAULT 'pendente',
        lancamento_id INTEGER REFERENCES lancamentos(id),
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(importacao_id, chave_externa)
      )`,
      `CREATE TABLE IF NOT EXISTS anexos (
        id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
        lancamento_id INTEGER REFERENCES lancamentos(id) ON DELETE SET NULL,
        nome_arquivo TEXT NOT NULL, caminho TEXT NOT NULL,
        mime TEXT NOT NULL DEFAULT 'application/octet-stream',
        tamanho INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS conciliacoes (
        id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
        conta_id INTEGER NOT NULL REFERENCES contas(id), data_inicio TEXT NOT NULL, data_fim TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('em_andamento','finalizada','cancelada')) DEFAULT 'em_andamento',
        lancamentos_conciliados INTEGER NOT NULL DEFAULT 0,
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finalizado_em TEXT
      )`,
    ];
    for (const sql of tabelasV4) db.run(sql);
    const indicesV4 = [
      'CREATE INDEX IF NOT EXISTS idx_importacoes_contexto ON importacoes(contexto_id, criado_em)',
      'CREATE INDEX IF NOT EXISTS idx_itens_importacao_status ON itens_importacao(importacao_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_itens_importacao_chave ON itens_importacao(chave_externa)',
      'CREATE INDEX IF NOT EXISTS idx_anexos_lancamento ON anexos(lancamento_id)',
      'CREATE INDEX IF NOT EXISTS idx_conciliacoes_conta ON conciliacoes(conta_id, data_inicio)',
    ];
    for (const sql of indicesV4) db.run(sql);
    db.run("INSERT OR REPLACE INTO meta (chave, valor) VALUES ('schema_version', '4')");
    destino = 4;
  }
  if (destino < 5) {
    // v0.8.7 — corrige itens_importacao.conta_id (era NOT NULL na migracao v3->v4, deveria ser nullable)
    // O schema.sql novo ja tem conta_id nullable, mas a migracao v3->v4 criou com NOT NULL.
    // Afeta todos os bancos que vieram de v3 (v0.5.x) e foram migrados pra v4 (v0.6.0+).
    // Sem o fix, a tela "Importar extrato" quebra com "NOT NULL constraint failed: itens_importacao.conta_id".
    // Procedimento: renomeia, recria com schema correto, copia dados, dropa o old.
    const cols = db.exec("PRAGMA table_info(itens_importacao)");
    const jaNullable = cols[0]?.values?.some((r) => r[1] === 'conta_id' && r[3] === 0);
    if (!jaNullable) {
      db.run("PRAGMA foreign_keys = OFF");
      db.run("ALTER TABLE itens_importacao RENAME TO _itens_importacao_old");
      db.run(`CREATE TABLE itens_importacao (
        id INTEGER PRIMARY KEY, importacao_id INTEGER NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
        conta_id INTEGER REFERENCES contas(id), data_transacao TEXT NOT NULL,
        valor_centavos INTEGER NOT NULL, descricao TEXT NOT NULL, chave_externa TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pendente','importado','ignorado','duplicado')) DEFAULT 'pendente',
        lancamento_id INTEGER REFERENCES lancamentos(id),
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(importacao_id, chave_externa)
      )`);
      db.run(`INSERT INTO itens_importacao (id, importacao_id, conta_id, data_transacao, valor_centavos, descricao, chave_externa, status, lancamento_id, criado_em)
              SELECT id, importacao_id, conta_id, data_transacao, valor_centavos, descricao, chave_externa, status, lancamento_id, criado_em FROM _itens_importacao_old`);
      db.run("DROP TABLE _itens_importacao_old");
      db.run("CREATE INDEX IF NOT EXISTS idx_itens_importacao_status ON itens_importacao(importacao_id, status)");
      db.run("CREATE INDEX IF NOT EXISTS idx_itens_importacao_chave ON itens_importacao(chave_externa)");
      db.run("PRAGMA foreign_keys = ON");
    }
    db.run("INSERT OR REPLACE INTO meta (chave, valor) VALUES ('schema_version', '5')");
    destino = 5;
  }
  if (destino < 6) {
    // v0.9.0 — Tela de Cartoes. Adiciona:
    //  - cartoes.conta_associada_id: aponta pra conta do tipo 'cartao' que esse
    //    cartao representa (criada automaticamente pelo criarCartao)
    //  - lancamentos.fatura_id: vincula o lancamento a uma fatura especifica
    //  - lancamentos.cartao_id: atalho pro cartao (pra queries tipo "compras deste cartao")
    // Todos NULLABLE: bancos antigos continuam funcionando, e o user preenche
    // aos poucos conforme cria cartoes e faturas.
    // E idempotente: so adiciona se nao existir.
    const colsCartao = db.exec("PRAGMA table_info(cartoes)");
    const temContaAssoc = colsCartao[0]?.values?.some((r) => r[1] === 'conta_associada_id');
    if (!temContaAssoc) {
      db.run("ALTER TABLE cartoes ADD COLUMN conta_associada_id INTEGER REFERENCES contas(id) ON DELETE SET NULL");
    }
    const colsLanc = db.exec("PRAGMA table_info(lancamentos)");
    const temFaturaId = colsLanc[0]?.values?.some((r) => r[1] === 'fatura_id');
    if (!temFaturaId) {
      db.run("ALTER TABLE lancamentos ADD COLUMN fatura_id INTEGER REFERENCES faturas(id) ON DELETE SET NULL");
      db.run("CREATE INDEX IF NOT EXISTS idx_lancamentos_fatura ON lancamentos(fatura_id)");
    }
    const temCartaoId = colsLanc[0]?.values?.some((r) => r[1] === 'cartao_id');
    if (!temCartaoId) {
      db.run("ALTER TABLE lancamentos ADD COLUMN cartao_id INTEGER REFERENCES cartoes(id) ON DELETE SET NULL");
      db.run("CREATE INDEX IF NOT EXISTS idx_lancamentos_cartao ON lancamentos(cartao_id)");
    }
    db.run("INSERT OR REPLACE INTO meta (chave, valor) VALUES ('schema_version', '6')");
    destino = 6;
  }
  if (destino < 7) {
    // v0.11.0 — Parcelamentos. Compra em Nx gera N parcelas automaticas,
    // cada uma vinculada a uma fatura especifica do cartao. Projecao mensal
    // pra ver o impacto futuro no orcamento.
    const tabelasV7 = [
      `CREATE TABLE IF NOT EXISTS parcelamentos (
        id INTEGER PRIMARY KEY,
        contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id),
        descricao TEXT NOT NULL,
        valor_total_centavos INTEGER NOT NULL CHECK (valor_total_centavos > 0),
        num_parcelas INTEGER NOT NULL CHECK (num_parcelas >= 2),
        cartao_id INTEGER REFERENCES cartoes(id) ON DELETE SET NULL,
        categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
        conta_pagamento_id INTEGER REFERENCES contas(id) ON DELETE SET NULL,
        dia_vencimento INTEGER NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 31),
        data_primeira_parcela TEXT NOT NULL,
        observacoes TEXT NOT NULL DEFAULT '',
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS parcelas (
        id INTEGER PRIMARY KEY,
        parcelamento_id INTEGER NOT NULL REFERENCES parcelamentos(id) ON DELETE CASCADE,
        numero INTEGER NOT NULL CHECK (numero >= 1),
        data_vencimento TEXT NOT NULL,
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
        status TEXT NOT NULL CHECK (status IN ('pendente','paga')) DEFAULT 'pendente',
        lancamento_id INTEGER REFERENCES lancamentos(id) ON DELETE SET NULL,
        fatura_id INTEGER REFERENCES faturas(id) ON DELETE SET NULL,
        paga_em TEXT,
        UNIQUE(parcelamento_id, numero)
      )`,
    ];
    for (const sql of tabelasV7) db.run(sql);
    const indicesV7 = [
      'CREATE INDEX IF NOT EXISTS idx_parcelamentos_contexto ON parcelamentos(contexto_id, ativo)',
      'CREATE INDEX IF NOT EXISTS idx_parcelas_parcelamento ON parcelas(parcelamento_id, numero)',
      'CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento ON parcelas(data_vencimento, status)',
      'CREATE INDEX IF NOT EXISTS idx_parcelas_fatura ON parcelas(fatura_id)',
    ];
    for (const sql of indicesV7) db.run(sql);
    db.run("INSERT OR REPLACE INTO meta (chave, valor) VALUES ('schema_version', '7')");
    destino = 7;
  }
  return destino;
}
