export const APP_VERSION = '0.4.1';

export async function abrirBancoLocal(SQL, schema) {
  if (!globalThis.Neutralino) throw new Error('O aplicativo precisa ser executado pelo MLopes Finance instalado.');
  const appData = await Neutralino.os.getEnv('APPDATA');
  if (!appData) throw new Error('A variÃƒÂ¡vel APPDATA nÃƒÂ£o estÃƒÂ¡ disponÃƒÂ­vel.');
  const dataDir = `${appData}/MLopesFinance/dados`;
  const arquivo = `${dataDir}/mlopes-finance.sqlite`;
  const temporario = `${arquivo}.tmp`;
  const antigo = `${arquivo}.old`;
  // Cria recursivamente: pai (MLopesFinance) e depois dados. createDirectory do Neutralino nao cria recursivo.
  try { await Neutralino.filesystem.createDirectory(`${appData}/MLopesFinance`); } catch { /* ja existe */ }
  try { await Neutralino.filesystem.createDirectory(dataDir); } catch { /* ja existe */ }
  let bytes;
  for (const candidato of [arquivo, antigo, temporario]) {
    try { bytes = new Uint8Array(await Neutralino.filesystem.readBinaryFile(candidato)); break; } catch { /* tenta a prÃƒÂ³xima cÃƒÂ³pia */ }
  }
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  if (!bytes) db.exec(schema);
  const persistir = async () => {
    await Neutralino.filesystem.writeBinaryFile(temporario, db.export());
    try { await Neutralino.filesystem.remove(antigo); } catch { /* nÃƒÂ£o existia */ }
    try { await Neutralino.filesystem.move(arquivo, antigo); } catch { /* primeiro salvamento */ }
    await Neutralino.filesystem.move(temporario, arquivo);
    try { await Neutralino.filesystem.remove(antigo); } catch { /* jÃƒÂ¡ removido */ }
  };
  return { db, persistir, arquivo };
}


