export function migrar(db) {
  db.run('CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)');
  const current = db.exec("SELECT valor FROM meta WHERE chave = 'schema_version'")[0]?.values[0]?.[0] ?? '0';
  if (Number(current) < 1) {
    db.run("INSERT OR REPLACE INTO meta (chave, valor) VALUES ('schema_version', '1')");
  }
  if (Number(current) < 2) {
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
  }
  if (Number(current) < 3) {
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
    // Indices
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
  }
  return 3;
}
