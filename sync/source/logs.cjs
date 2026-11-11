// Product-facing diagnostics; the compatibility logger remains the data source.
async function downloadSyncLogs({ logger, version, anonymous = false, now = new Date() }) {
  let logs = await logger.getLogs();
  if (anonymous) logs = await logger.anonymizeLogs(logs);
  const filename = `super-extensao-sincronizacao-${version}-${now.toISOString().slice(0, 10)}-${anonymous ? "anonimizado" : "completo"}.log`;
  const header = `Super Extensão — Sincronização\nVersão: ${version}\nData: ${now.toISOString()}\n\n`;
  return logger.download(filename, new Blob([header, logs.join("\n")], { type: "text/plain", endings: "native" }));
}
module.exports = { downloadSyncLogs };
