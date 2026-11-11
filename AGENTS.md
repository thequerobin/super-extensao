# Versionamento da Super Extensão

Ao publicar uma alteração que afete a extensão instalada, incremente a versão antes de sincronizar a pasta do OneDrive e publicar no GitHub. Para correções e ajustes visuais, incremente o terceiro número, como de `1.5.3` para `1.5.4`.

Confira se a versão do projeto é igual em `manifest.json`, `package.json` e `package-lock.json`. No lockfile, atualize o campo da raiz e `packages[""].version`. O navegador mostra a versão do `manifest.json`.

# Publicação após alterações

Após concluir e validar qualquer alteração no projeto, incluindo documentação, faça commit e publique no GitHub com push para `origin/main`, sem pedir nova confirmação. Esta é uma autorização permanente do usuário para este projeto.

Use `C:\Users\luizh\OneDrive\Documentos\super-extensao` como pasta principal e repositório Git. Confira o remoto antes de publicar: `https://github.com/thequerobin/super-extensao.git`. Preserve alterações do usuário e nunca use push forçado. Se a publicação falhar, informe o motivo e não declare que foi publicada.

Alterações apenas de documentação não exigem incremento da versão da extensão. Alterações que afetem a extensão instalada seguem a regra de versionamento acima. Ao terminar, informe o commit publicado e confirme o estado do repositório.
