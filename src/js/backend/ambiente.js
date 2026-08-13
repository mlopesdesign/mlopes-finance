export const APP_VERSION = '0.8.8';

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
  // Persistencia atomica (PADRAO ML LOPES DESIGN secao 4.3):
  //   1) escreve em <arquivo>.tmp
  //   2) move <arquivo> -> <arquivo>.old (se existir; senao ignora = fresh install)
  //   3) move <arquivo>.tmp -> <arquivo>
  //   4) deixa <arquivo>.old como recovery. NAO remove automaticamente:
  //      a proxima gravacao o sobrescreve. Em caso de corrupcao, basta
  //      restaurar manualmente o .old.
  const persistir = async () => {
    // 1. tmp
    await Neutralino.filesystem.writeBinaryFile(temporario, db.export());
    // 2. atual -> .old (silencioso se atual nao existe)
    try {
      await Neutralino.filesystem.move(arquivo, antigo);
    } catch {
      // atual nao existia (fresh install) OU .old bloqueou a sobrescrita.
      // Em Windows, `move` nao sobrescreve destino; garantimos removendo antes.
      try { await Neutralino.filesystem.remove(antigo); } catch { /* ok */ }
      try { await Neutralino.filesystem.move(arquivo, antigo); } catch { /* fresh install */ }
    }
    // 3. tmp -> atual
    await Neutralino.filesystem.move(temporario, arquivo);
    // 4. .old preservado (recovery manual)
  };
  return { db, persistir, arquivo };
}
