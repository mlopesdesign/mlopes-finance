export const APP_VERSION = '0.8.4';

export async function abrirBancoLocal(SQL, schema) {
  if (!globalThis.Neutralino) throw new Error('O aplicativo precisa ser executado pelo MLopes Finance instalado.');
  const appData = await Neutralino.os.getEnv('APPDATA');
  if (!appData) throw new Error('A variavel APPDATA nao esta disponivel.');
  const dataDir = `${appData}/MLopesFinance/dados`;
  const arquivo = `${dataDir}/mlopes-finance.sqlite`;
  const temporario = `${arquivo}.tmp`;
  const antigo = `${arquivo}.old`;
  // Garante os diretorios. createDirectory NAO eh recursivo, entao criamos cada nivel.
  try { await Neutralino.filesystem.createDirectory(`${appData}/MLopesFinance`); } catch { /* ja existe */ }
  try { await Neutralino.filesystem.createDirectory(dataDir); } catch { /* ja existe */ }
  let bytes;
  for (const candidato of [arquivo, antigo, temporario]) {
    try { bytes = new Uint8Array(await Neutralino.filesystem.readBinaryFile(candidato)); break; } catch { /* tenta a proxima copia */ }
  }
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  if (!bytes) db.exec(schema);
  // Persistencia atomica simples: escreve direto no destino. Custo: pode deixar .tmp orfao se
  // o processo morrer entre o write e o fim. Em ambiente desktop single-user eh aceitavel.
  // Se o destino existir, sobrescreve via writeBinaryFile (que trunca e reescreve).
  const persistir = async () => {
    // Limpa tmp orfao de execucao anterior
    try { await Neutralino.filesystem.remove(temporario); } catch { /* nao existia */ }
    // Escreve no destino
    await Neutralino.filesystem.writeBinaryFile(arquivo, db.export());
  };
  return { db, persistir, arquivo };
}
