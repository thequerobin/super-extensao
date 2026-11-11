# Interface de sincronização — referência 1.5.19

A aplicação de sincronização da Super Extensão fica em `sync/source`. O motor Floccus 5.13.0 continua em `vendor/floccus-source`; a sincronização normal continua usando esse algoritmo, seus conectores e o bundle de segundo plano. O novo núcleo Google Drive é usado somente pela comparação sem escrita.

## Telas

- **Perfis:** estado vazio, busca por nome/serviço/pasta, status, última sincronização, opções e sincronização manual. Enviar/receber uma única vez ficam em ações avançadas, com confirmação do sentido da operação. Cancelamento, autorização, execução forçada e logs continuam disponíveis conforme o estado do perfil.
- **Novo perfil:** seleção de serviço em cartões e assistente para nome, conexão, pasta e comportamento. Mantém os oito serviços e a seleção de favoritos ou abas do motor atual.
- **Backup:** importação e exportação de perfis. O arquivo pode conter credenciais e não é uma cópia dos favoritos. Perfis existentes são selecionados ao abrir a tela.
- **Conexões:** configuração OAuth própria para Google Drive e Dropbox. Credenciais específicas dos outros serviços continuam nos perfis.

Tema e idioma acompanham as preferências compartilhadas. As telas internas não abrem outras abas. O login dos provedores continua usando o fluxo externo autorizado pelo respectivo serviço.

## Compatibilidade e origem

As chaves `superSync:`, os IDs de perfil, os formatos de importação/exportação, alarmes e mensagens `super-sync` foram mantidos. Atualizar a interface não exige migração nem recriação de perfis. A edição usa um rascunho; sair sem salvar não altera o perfil carregado. As telas de perfis e credenciais só montam após consultar o bloqueio do motor.

A interface usa Vue/Vuetify e inclui formulários e fluxos de autenticação adaptados do Floccus, sob MPL-2.0. Não é uma reimplementação integral de todos os componentes. Os créditos, licença e fonte original continuam disponíveis em `sync/LICENSE.txt`, `sync/MODIFICATIONS.md` e `vendor/floccus-source`.

`sync/source/store/actions.js` é a fronteira dos comandos com o motor existente. A compilação resolve `@sync-engine` para `vendor/floccus-source/src/lib`. Os componentes de pastas, tradução e autorização ainda usam auxiliares dessa API; a futura troca do motor precisará substituir esses contratos também.

## Compilar

Na raiz, com Node.js 20 ou superior:

```sh
npm ci
npm run setup:sync
npm run setup:vpn
npm run build:sync
npm test
```

`setup:vpn` instala as dependências já utilizadas pelo compilador compartilhado de estilos dos painéis. Não é necessário recompilar a VPN.

`build:sync` gera `sync/js/options.js`, `sync/js/options.css` e os recursos de fonte, copia `sync/source/interface.css` para `sync/theme.css` e recompila `popup-panels.css`. Não substitui `sync/js/background-script.js`. Os arquivos compilados ficam no repositório; instalar a extensão descompactada não exige Node.js.

Para alterar as telas, edite `sync/source`, e não as telas antigas em `vendor/floccus-source/src/ui`. A configuração antiga `webpack.super.cjs` continua disponível para a origem histórica, mas não deve ser usada para substituir o bundle da interface própria.

## Validação

A suíte Node inclui testes DOM do bundle de produção com JSDOM e APIs Chromium simuladas: navegação, idioma, oito serviços, configuração OAuth isolada, leitura de perfis existentes, rascunhos antes/depois de salvar, seleção na exportação, confirmação de sincronização direcional, teste de conexão e criação WebDAV, e bloqueio das telas quando o motor está protegido.

O Chromium não iniciou neste ambiente (`socket() failed: Operation not permitted`). Os testes DOM não verificam geometria, contraste, foco nativo ou tráfego real. Antes de liberar, conferir no Helium/Chromium: temas claro/escuro/sistema, rolagem e altura do popup, seleção de pastas e diálogos, criação/edição/importação/exportação e login/sincronização nos provedores usados. Nenhuma conta real foi conectada durante estes testes.

## Início do motor próprio (1.5.19)

As opções de um perfil Google Drive incluem uma comparação somente de leitura, implementada em `sync/engine` sem importar o motor legado. Ela usa a configuração salva para comparar o inventário local e o XBEL remoto; não migra perfis nem altera a execução da sincronização. Escopo, limitações e próximos passos estão em [sync-engine.md](sync-engine.md).
