# Versionamento da Super Extensão

Ao publicar uma alteração que afete a extensão instalada, incremente a versão antes de sincronizar a pasta do OneDrive e publicar no GitHub. Para correções e ajustes visuais, incremente o terceiro número, como de `1.5.3` para `1.5.4`.

Confira se a versão do projeto é igual em `manifest.json`, `package.json` e `package-lock.json`. No lockfile, atualize o campo da raiz e `packages[""].version`. O navegador mostra a versão do `manifest.json`.
