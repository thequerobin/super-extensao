# Dependências da VPN — 1.7.17

Revisão em 12 de novembro de 2026. Escopo: `vendor/proton-source` e os artefatos VPN compilados. Os módulos de sincronização/nova guia e suas árvores de dependências não foram atualizados nesta etapa.

## Versões selecionadas

Foram aplicadas atualizações estáveis compatíveis com as faixas principais existentes. `typescript-eslint` passa a declarar uma versão estável mínima, removendo a referência alpha. O lockfile registra as versões e integridades resolvidas; `npm ci` foi executado do zero com sucesso.

| Dependência | Antes | Depois | Uso | Licença declarada |
| --- | --- | --- | --- | --- |
| `@sentry/browser` | 10.58.0 | 10.78.0 | Produção | MIT |
| `@babel/core` | 8.0.1 | 8.1.2 | Desenvolvimento | MIT |
| `@babel/preset-env` | 8.0.1 | 8.0.7 | Desenvolvimento | MIT |
| `@jest/globals` | 30.4.1 | 30.5.2 | Desenvolvimento | MIT |
| `@types/chrome` | 0.2.0 | 0.2.9 | Desenvolvimento | MIT |
| `@types/firefox-webext-browser` | 143.0.0 | 143.0.1 | Desenvolvimento | MIT |
| `@types/node` | 25.9.3 | 25.9.9 | Desenvolvimento | MIT |
| `@typescript-eslint/eslint-plugin` | 8.61.1 | 8.72.2 | Desenvolvimento | MIT |
| `@typescript-eslint/parser` | 8.61.1 | 8.72.2 | Desenvolvimento | MIT |
| `ajv` | 6.14.0 (transitiva) | 8.20.0 | Desenvolvimento | MIT |
| `chrome-webstore-upload-cli` | 4.0.1 | 4.0.2 | Desenvolvimento | MIT |
| `css-loader` | 7.1.4 | 7.1.5 | Desenvolvimento | MIT |
| `eslint` | 10.5.0 | 10.14.0 | Desenvolvimento | MIT |
| `eslint-plugin-prettier` | 5.5.6 | 5.5.7 | Desenvolvimento | MIT |
| `fflate` | adicionada | 0.8.3 | Desenvolvimento | MIT |
| `glob` | 13.0.6 | 13.0.7 | Desenvolvimento | BlueOak-1.0.0 |
| `jest` | 30.4.2 | 30.5.2 | Desenvolvimento | MIT |
| `jest-environment-jsdom` | 30.4.1 | 30.5.2 | Desenvolvimento | MIT |
| `lint-staged` | 17.0.7 | 17.6.0 | Desenvolvimento | MIT |
| `node-html-parser` | 9.0.0 | 9.0.7 | Desenvolvimento | MIT |
| `npm-run-all2` | 9.0.2 | 9.0.4 | Desenvolvimento | MIT |
| `prettier` | 3.8.4 | 3.10.1 | Desenvolvimento | MIT |
| `sass` | 1.101.0 | 1.108.2 | Desenvolvimento | MIT |
| `sass-loader` | 17.0.0 | 17.1.0 | Desenvolvimento | MIT |
| `stylelint` | 17.13.0 | 17.16.0 | Desenvolvimento | MIT |
| `ts-jest` | 29.4.11 | 29.4.15 | Desenvolvimento | MIT |
| `typescript-eslint` | 8.61.1 | 8.72.2 | Desenvolvimento | MIT |
| `web-ext` | 10.4.0 | 10.8.0 | Desenvolvimento | MPL-2.0 |
| `webpack` | 5.107.2 | 5.112.2 | Desenvolvimento | MIT |
| `webpack-cli` | 7.0.3 | 7.3.1 | Desenvolvimento | MIT |

`decompress@4.2.1` foi removido: possui alerta crítico de extração fora do destino e não há correção disponibilizada para esse pacote na auditoria consultada. `repack.js` passa a usar `fflate@0.8.3` em memória, sem extração ou comandos shell. Mantém nomes/conteúdo dos arquivos e data determinística, valida caminhos, limita tamanho/quantidade de entradas e só substitui o destino depois do ZIP pronto. Falhas preservam o arquivo anterior e retornam código de saída não zero. `archiver@7.0.1`, sem referências nas fontes presentes, também foi removido.

`ajv@8.20.0` é declarado como ferramenta direta para satisfazer `ajv-keywords@5`/`schema-utils@4`. A instalação com `--legacy-peer-deps` havia elevado AJV 6 do ESLint e quebrado o Webpack. AJV 6 permanece isolado nos consumidores antigos; o build usa AJV 8 e `npm ls ajv ajv-keywords --all` passa. O mesmo procedimento funciona após instalação limpa pelo lockfile.

## Auditoria e limites

| Árvore consultada pelo npm | Total | Críticos | Altos | Moderados | Baixos |
| --- | --- | --- | --- | --- | --- |
| VPN completa, primeiro snapshot anterior | 47 | 3 | 17 | 25 | 2 |
| VPN completa, após atualizar | 31 | 0 | 0 | 24 | 7 |
| VPN, somente dependências de produção | 0 | 0 | 0 | 0 | 0 |

São contagens de entradas do relatório npm, incluindo propagação para consumidores, não números de falhas independentes. O banco de advisories muda; essas contagens são snapshots, não uma certificação. A classificação de produção segue `npm audit --omit=dev`, não uma análise de cada linha dos bundles. A auditoria não cobre o protocolo Proton, as outras árvores da extensão ou vazamento IP/DNS.

Os alertas restantes estão em ferramentas de desenvolvimento: principalmente a cadeia `minimatch` de glob/Jest/ESLint e `deepmerge` no empacotador `web-ext`. O npm propõe também downgrades ou alterações de versão principal em vários consumidores. Eles não foram aplicados automaticamente nem ocultados com overrides gerais. Permanecem como manutenção pendente, com atenção especial ao processamento de fontes/arquivos de terceiros por essas ferramentas.

Sentry permanece na linha 10 (10.78.0). A [migração oficial para 11](https://docs.sentry.io/platforms/javascript/migration/v10-to-v11/) altera padrões de coleta e exige revisão própria; não foi incluída. O cliente real atualizado foi testado com `enabled=false`, sem DSN, sem relatórios do cliente e sem integrações de breadcrumbs/erros globais. TypeScript 7 e as demais migrações principais também ficam para avaliação separada.

## Licenças e reprodução

GPL-3.0 do código Proton, avisos e arquivos LICENSE foram preservados. Os dois novos pacotes diretos (`fflate`, `ajv`) declaram MIT. Foram conferidas as licenças declaradas dos pacotes diretos e as expressões do lockfile. As transitivas incluem licenças permissivas, MPL-2.0 e alternativas GPL já presentes; alguns metadados mudaram entre releases (por exemplo, ISC para BlueOak-1.0.0). Não foi realizada auditoria jurídica de todos os textos de licença transitivos. O build agora gera `vpn/THIRD-PARTY-NOTICES.txt` com os textos completos de licença/avisos e os links de origem das 17 dependências de produção do lockfile, incluindo pacotes que o tree shaking possa excluir dos bundles. A geração exige versões instaladas iguais às travadas e falha se não localizar o texto da licença.

O módulo VPN agora declara **Node >=24.11.0**, compatível com Babel 8 atualizado. A execução desta revisão usou Node 24.22.1 e npm 11.9.0. Instalar a extensão compilada no navegador não exige Node. Reproduzir na raiz:

```sh
npm ci
npm run setup:vpn
npm run build:vpn
npm test
npm run check:ui
```

Checks adicionais executados: TypeScript do worker e da interface, instalação limpa com scripts de instalação desabilitados, validação AJV, auditorias completas/de produção e `git diff --check`. A suíte tem 397 testes, incluindo sete contratos novos de empacotamento e privacidade. Não foram executados login, conexão Proton ou captura de tráfego nesta rodada. O usuário informou que validou a correção de navegação da 1.7.16 antes de autorizar esta etapa.
