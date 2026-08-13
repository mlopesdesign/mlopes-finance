export const APP_VERSION = '0.8.16';

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
  //   2) move <arquivo> -> <arquivo>.old (sobrescreve .old se ja existir)
  //   3) move <arquivo>.tmp -> <arquivo> (sobrescreve atual)
  //   4) deixa <arquivo>.old como recovery. NAO remove automaticamente.
  //
  // IMPORTANTE: usa `cmd.exe /c move /Y` (sobrescreve destino) em vez de
  // `Neutralino.filesystem.move` (que NAO sobrescreve no Windows — bug
  // v0.8.8: .old de gravacao anterior bloqueava o move, persistir falhava
  // silenciosamente, dados em memoria nunca chegavam ao disco).
  //
  // Fallback para testes: se `os.execCommand` nao estiver disponivel, usa
  // `filesystem.remove + move` (sobrescreve destino removendo antes).
  async function moverSeguro(origem, destino) {
    if (!globalThis.Neutralino) throw new Error('Neutralino nao disponivel');
    // 1. Producao: cmd.exe /c move /Y (sobrescreve destino, confiavel)
    if (Neutralino.os?.execCommand) {
      try {
        const cmd = `cmd.exe /c move /Y "${origem}" "${destino}"`;
        const r = await Neutralino.os.execCommand(cmd, { background: false });
        if (r.exitCode === 0) return;
        if (r.stdErr && /cannot find/i.test(r.stdErr)) return; // origem sumiu
        // Cai no fallback
      } catch { /* cai no fallback */ }
    }
    // 2. Fallback: remove destino antes, depois move (sobrescreve)
    if (Neutralino.filesystem?.move) {
      try { await Neutralino.filesystem.remove(destino); } catch { /* ok */ }
      try { await Neutralino.filesystem.move(origem, destino); } catch { /* origem sumiu */ }
    }
  }
  const persistir = async () => {
    // 1. tmp
    await Neutralino.filesystem.writeBinaryFile(temporario, db.export());
    // 2. atual -> .old (move sobrescreve .old se ja existir)
    await moverSeguro(arquivo, antigo);
    // 3. tmp -> atual (move sobrescreve)
    await moverSeguro(temporario, arquivo);
    // 4. .old preservado (recovery manual). NAO removido.
  };
  return { db, persistir, arquivo };
}
