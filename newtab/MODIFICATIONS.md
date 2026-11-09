# Tabliss 2.6.0 na Super Extensão

Este diretório contém a página completa do Tabliss 2.6.0, um componente GPL-3.0. O texto da licença está em [LICENSE.txt](LICENSE.txt), os avisos das dependências em [main.js.LICENSE.txt](main.js.LICENSE.txt) e o código-fonte correspondente em [vendor/tabliss-source](../vendor/tabliss-source/).

Origem: [joelshepherd/tabliss, tag 2.6.0](https://github.com/joelshepherd/tabliss/tree/2.6.0), commit `a273d6329cec1f0813e04fde907111e648821946`. O bundle de produção foi obtido da instalação 2.6.0 do Tabliss, ID `hipekcciheckooncpjeljhnekcoolahp`. A marca e os créditos do Tabliss na interface de configuração foram preservados.

## Alterações em 2026-11-09

- Entrada HTML adaptada para `newtab/`, com caminhos relativos, ícone da Super Extensão e viewport com zoom permitido.
- Botão separado para abrir as configurações de limpeza, autoplay e abas da Super Extensão, sem modificar os controles nativos do dashboard.
- Envio de erros ao Sentry desativado: DSN vazio e `enabled: false`, tanto no bundle quanto em `src/errorHandler.ts`.
- Fundo inicial alterado de Unsplash para o gradiente local do próprio Tabliss, tanto no bundle quanto em `src/db/state.ts`. Todos os provedores originais continuam disponíveis nas configurações.
- `publicPath` do código-fonte ajustado para `./`, para gerar recursos relativos ao subdiretório.

Os widgets, o editor, os provedores, as traduções e a importação/exportação originais foram mantidos. A configuração usa o namespace original `tabliss/config` em `storage.sync` e o cache original `tabliss/cache` em IndexedDB, separados das configurações locais de limpeza/abas/autoplay. Imagens próprias são mantidas pelo armazenamento do dashboard. A limpeza da Super Extensão não solicita a remoção de dados de extensões.

Os provedores e widgets online fazem suas próprias requisições aos serviços escolhidos; podem estar sujeitos à disponibilidade e às cotas desses serviços. Não há migração automática da instalação separada do Tabliss: use a exportação/importação na interface original.

## Código-fonte e reconstrução

O snapshot em `vendor/tabliss-source/` contém os arquivos de configuração, lockfile, código-fonte e scripts da tag original, com as alterações acima identificadas. O código do dashboard mantém a licença GPL-3.0 e os avisos originais.

Para reconstruir o dashboard com o toolchain original, use um ambiente compatível com as dependências de 2022, incluindo Node 16 e as ferramentas nativas exigidas por `node-sass@7`. Dentro de `vendor/tabliss-source/`, instale com `npm ci` e execute `npm run build:chromium` em um shell compatível com variáveis POSIX. As integrações de Unsplash e GIPHY usam as variáveis indicadas em `.env.example`; uma reconstrução para distribuição deve configurar suas próprias credenciais de cliente desses serviços.

O resultado fica em `dist/chromium/`. Para instalar na Super Extensão, copie os recursos gerados para `newtab/`, mantenha a entrada HTML e os arquivos `integration.js`/`integration.css` desta integração e preserve a licença e os avisos. Não substitua o manifesto principal pelo manifesto standalone gerado para o Tabliss.
