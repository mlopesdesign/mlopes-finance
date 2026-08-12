export function migrar(db) {
  db.run('CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)');
  const current = db.exec("SELECT valor FROM meta WHERE chave = 'schema_version'")[0]?.values[0]?.[0] ?? '0';
  if (Number(current) < 1) {
    db.run("INSERT OR REPLACE INTO meta (chave, valor) VALUES ('schema_version', '1')");
  }
  if (Number(current) < 2) {
    // v0.4.0 — sistema de configurações editáveis (tema, marca, identidade)
    db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('texto','numero','cor','booleano','arquivo')) DEFAULT 'texto',
      atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const defaults = [
      ['tema', 'dark', 'texto'],
      ['marca_cor', '#155e6f', 'cor'],
      ['nome_exibicao', 'MLopes Finance', 'texto'],
      ['moeda', 'BRL', 'texto'],
      ['locale', 'pt-BR', 'texto'],
    ];
    for (const [chave, valor, tipo] of defaults) {
      db.run(`INSERT OR IGNORE INTO configuracoes (chave, valor, tipo) VALUES (?, ?, ?)`, [chave, valor, tipo]);
    }
    db.run("INSERT OR REPLACE INTO meta (chave, valor) VALUES ('schema_version', '2')");
  }
  return 2;
}
