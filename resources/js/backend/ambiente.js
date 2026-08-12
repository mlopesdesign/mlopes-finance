export const APP_VERSION = '0.5.0';

export async function abrirBancoLocal(SQL, schema) {
  if (!globalThis.Neutralino) throw new Error('O aplicativo precisa ser executado pelo MLopes Finance instalado.');
  const appData = await Neutralino.os.getEnv('APPDATA');
  if (!appData) throw new Error('A variavel APPDATA nao esta disponivel.');
  const dataDir = `${appData}/MLopesFinance/dados`;
  const arquivo = `${dataDir}/mlopes-finance.sqlite`;
  const temporario = `${arquivo}.tmp`;
  const antigo = `${arquivo}.old`;
  try { await Neutralino.filesystem.createDirectory(`${appData}/MLopesFinance`); } catch { /* ja existe */ }
  try { await Neutralino.filesystem.createDirectory(dataDir); } catch { /* ja existe */ }
  let bytes;
  for (const candidato of [arquivo, antigo, temporario]) {
    try { bytes = new Uint8Array(await Neutralino.filesystem.readBinaryFile(candidato)); break; } catch { /* tenta a proxima copia */ }
  }
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  if (!bytes) db.exec(schema);
  const persistir = async () => {
    await Neutralino.filesystem.writeBinaryFile(temporario, db.export());
    try { await Neutralino.filesystem.remove(antigo); } catch { /* nao existia */ }
    try { await Neutralino.filesystem.move(arquivo, antigo); } catch { /* primeiro salvamento */ }
    await Neutralino.filesystem.move(temporario, arquivo);
    try { await Neutralino.filesystem.remove(antigo); } catch { /* ja removido */ }
  };
  return { db, persistir, arquivo };
}
