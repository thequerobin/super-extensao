# Componentes da interface — referência 1.7.31


## Fluxos compartilhados — 1.7.31

Além das primitivas visuais, os seguintes fluxos têm uma fonte comum:

| Fonte | Consumidores e contrato |
| --- | --- |
| `ui/bookmark-importer.js` | Limpeza e VPN: montagem dos controles, solicitação síncrona de permissão no clique, carregamento de pastas, seleção, subpastas, prévia, duplicados, importação, erro e nova tentativa. O adaptador injeta normalização, destino e persistência. Respostas tardias não importam em outro destino nem após descarte. |
| `ui/domain-editor.js` | Entrada, botão Adicionar, Enter, validação pelo adaptador, prevenção de adições concorrentes, contagem e estado vazio. Não limpa texto inválido nem descarta texto digitado durante uma gravação pendente. |
| `ui/cleanup-editors.cjs` | Gera os três formulários de exceções da limpeza a partir do mesmo editor, preservando IDs, traduções e chaves independentes. Os templates incluem apenas a configuração de cada destino. |
| `ui/domain-list.js` | Listas da limpeza, VPN e autoplay. A linha pode ter descrição e seletor de ação; conserva rolagem, limite de altura e remoção acessível. O autoplay injeta Permitir/Bloquear e suas gravações. |
| `ui/bookmark-preview.js` | Cartão de prévia com todos os domínios e marcação dos já existentes. |
| `ui/async-state.js` | Carregamento, erro, estado vazio e nova tentativa. Usado pelo importador, recursos/servidores da VPN e, via `UiAsyncState`, pelas telas de perfis e conexões da sincronização. |
| `ui/confirmation.js` | Confirmações explícitas da limpeza, saída/liberação/abandono de rascunho da VPN, exclusão de perfil/sincronização forçada e redefinição da nova guia. Usa diálogo modal nativo com textos seguros, foco inicial em Cancelar, Escape, circulação de foco, restauração do foco e cancelamento ao encerrar a página. |
| `vpn/source/screens/` | Conexão, servidores, recursos e conta em módulos próprios. `app.js` conserva estado, eventos, integração com o motor e ciclo de vida. |

O editor da limpeza continua gravando automaticamente. Importar na VPN altera apenas o rascunho do modo selecionado; Salvar aplica as regras. A interface não concede controles bloqueados por política nem altera o estado de proteção por conta própria. Uma confirmação de liberação da VPN fica inválida se o estado da conexão mudar enquanto o diálogo estiver aberto.

Na compilação da sincronização, os módulos UMD compartilhados não passam pelo injetor de polyfills do Babel: a injeção de imports ESM nesses arquivos descartava os exports CommonJS. Os demais arquivos continuam usando o pipeline existente. O requisito mínimo da extensão é Chromium 116.

Validação da entrega: **483 testes aprovados**, interfaces de VPN/sincronização/nova guia compiladas, TypeScript do worker e da interface VPN aprovado e `check:ui` aprovado. O cenário adicional de autenticação do proxy passou no teste nativo local descrito em `vpn-validacao-pc.md`.

### O que ainda não foi unificado

- A árvore hierárquica de pastas e os assistentes/formulários validados dos provedores de sincronização ainda usam componentes `Sync*`/Vuetify. O importador comum copia domínios de favoritos; a seleção de escopo de sincronização tem outro contrato e não foi trocada por um seletor simples.
- Editores de widgets, fundos e opções específicas da nova guia continuam como composições React próprias, sobre as primitivas compartilhadas.
- A página de bloqueio da VPN conserva a confirmação local de liberação e seus estados de recuperação, com o fluxo de segurança e testes existentes. Não foi convertida para o diálogo comum nesta alteração.
- Outros feedbacks específicos (progresso de operações, relatórios da limpeza e erros de importação da nova guia) ainda não usam todos o componente genérico de estado.
- Falta a conferência visual manual dos novos fluxos no navegador pessoal, em temas claro/escuro, com teclado e textos longos. Testes DOM e compilações não substituem essa conferência.

Ajuste visual 1.6.11: a barra da esquerda e o botão Super Extensão compartilham `--newtab-controls-inset` (12 px) e `--newtab-controls-height` (46 px). A barra esquerda usa 50% de opacidade em repouso e 100% em hover ou foco interno de teclado. A transição é desativada quando o sistema solicita movimento reduzido.

Ajuste visual 1.6.10: a barra de controles da página inicial usa `UiActions` e `UiButton`, com cores do tema global, borda e raio comuns, ícones de 16 px e botões de 36 px. Configurações, widgets e tela cheia ficam visíveis e acessíveis por teclado, com nomes e estados ARIA. O indicador de carregamento e o botão de erros continuam condicionais.

Ajuste visual 1.6.9: os campos de idioma e fuso horário do editor ficam em `UiStack`, com 12 px de separação entre linhas. O botão nativo de seleção de arquivos reserva 12 px até o nome do arquivo. O controle de pausa do Unsplash fica somente na página inicial, junto dos créditos da imagem; foi removido das configurações de intervalo.

Revisado em 11 de novembro de 2026. As telas usam um catálogo comum de componentes com adaptadores para HTML, DOM, Vue e React. Tema, cores, medidas e foco ficam em `ui-theme.css` e `ui-components.css`. Os componentes não acessam armazenamento, rede, credenciais ou motores.

## Fontes e responsabilidades

| Fonte | Responsabilidade |
| --- | --- |
| `ui/catalog.json` | Tags nativas, classes, atributos padrão e variantes permitidas |
| `ui/render.cjs` | Expansão dos componentes declarativos em HTML nativo, na compilação e na VPN |
| `ui/dom.cjs` → `ui.js` | Criação dos controles dinâmicos do popup com nós DOM |
| `ui/vue.js` | Componentes funcionais `Ui*` para Vue, sem elemento adicional |
| `sync/source/components/ui/engine.js` | Adaptadores `Sync*` dos controles validados, diálogos, árvore e assistente Vuetify |
| `ui/vue.css` | Aparência dos controles validados, separada do layout das telas |
| `vendor/tabliss-source/src/ui/index.tsx` | Componentes React do editor, fundos, widgets e controles auxiliares |
| `ui/templates/` | Fontes das páginas estáticas; popup separado em seções e rodapé |
| `ui-components.css` | Aparência e espaçamento dos componentes comuns |
| CSS de cada módulo | Composição específica, como grupos de países e editor de widgets |

React, Vue e Vuetify permanecem como dependências. Os adaptadores `Sync*` estendem os controles existentes para preservar validação, modelos, slots, referências, injeção e protocolos entre pais e filhos. Esta refatoração componentiza a interface; não substitui os frameworks, motores, autenticação ou conectores legados por implementações independentes.

## Catálogo

| Componente | Uso |
| --- | --- |
| `button` | Ação nativa com `type="button"` por padrão; formulários exigem `type="submit"` explícito |
| `field`, `control` | Rótulo e campo; variantes `input`, `select` e `textarea` |
| `check`, `toggle` | Rótulos de caixas de seleção e switches |
| `card`, `fieldset` | Cartões e grupos de campos, com variantes semânticas |
| `stack`, `form`, `actions` | Organização vertical, formulário e grupo de ações com quebra de linha |
| `heading`, `title`, `note` | Cabeçalhos, títulos e descrições |
| `notice`, `empty` | Avisos e estados vazios |
| `nav`, `tab`, `sr` | Navegação e texto para leitores de tela |

As variantes visuais continuam nas classes `ui-button-primary`, `ui-button-secondary`, `ui-button-danger`, `ui-button-compact`, `ui-notice-error`, `ui-notice-warning` e `ui-notice-success`. `ui-card-framed` reserva o preenchimento para o corpo do cartão. Buscas compostas usam `ui-search ui-focus-within`. Controles especiais React, como checkbox, range, cor e arquivo, recebem classes específicas.

O catálogo define a estrutura e o CSS comum define sua apresentação. Não copie a implementação de um campo nem valores de cor/foco para outra tela. Use o adaptador correspondente e deixe os estilos locais cuidarem da composição.

## Usar os adaptadores

### HTML estático e VPN

```html
<ui-stack>
  <ui-field for="token">Chave de API</ui-field>
  <ui-control id="token" type="password" />
  <ui-actions>
    <ui-button type="submit">Salvar</ui-button>
  </ui-actions>
</ui-stack>
```

`build:ui` expande os templates estáticos antes da instalação. Na VPN, `renderUi` expande os templates ao renderizar a tela. A saída é HTML nativo. Não há custom elements, Shadow DOM ou observador de mutações para montar os componentes do popup.

`renderUi` aceita apenas templates controlados pelo projeto e não sanitiza HTML arbitrário. Na VPN, valores externos continuam passando por `escapeHtml` antes da interpolação. O adaptador DOM transforma strings em nós de texto.

```js
const remove = SuperUi.create("button", {
  className: "ui-button-compact ui-button-danger",
  attrs: { "aria-label": "Remover domínio" },
  on: { click: onRemove }
}, "×");
```

### Vue e React

Vue registra `Ui*` globalmente. Campos nativos simples podem continuar com o `v-model` do compilador e a classe `ui-control`; `UiControl` também suporta modelo textual e seleção simples. Os formulários de provedores usam `SyncTextField`, `SyncSelect`, `SyncSwitch`, `SyncForm`, `SyncDialog`, `SyncTree` e os demais adaptadores validados. Não substitua esses controles por inputs nativos sem cobrir suas regras e eventos.

React importa `UiField`, `UiInput`, `UiSelect`, `UiTextarea`, `UiButton`, `UiCard`, `UiStack`, `UiActions`, `UiNote` e `UiNotice` de `src/ui`. Propriedades e eventos permanecem os das tags correspondentes. Os componentes preservam valores controlados e não contêm regras dos provedores de imagens. O painel de chaves é a mesma composição para Unsplash e GIPHY.

## Compilar

Node.js 20 ou superior, na raiz:

```sh
npm ci
npm run setup:sync
npm run setup:vpn
npm run setup:newtab
npm run build:interfaces
npm run check:ui
npm test
```

`build:interfaces` gera as páginas estáticas e compila sincronização, VPN, nova guia e estilos dos painéis. Não recompila os workers. Os arquivos gerados continuam versionados e a instalação sem compactação dispensa Node.js.

| Alteração | Regenerar |
| --- | --- |
| Templates estáticos ou adaptador DOM | `npm run build:ui` |
| Catálogo comum | `npm run build:interfaces` |
| Adaptador/skin Vue ou tela de sincronização | `npm run build:sync` |
| Templates da VPN | `npm run build:vpn-ui` |
| Adaptador React ou editor da nova guia | `npm run build:newtab` |
| `ui-components.css` | `npm run build:panels`; páginas independentes importam o CSS diretamente |

Não edite `popup.html`, `spare-tab.html`, `newtab/index.html` ou `ui.js` diretamente. As fontes estão em `ui/templates/`, `ui/dom.cjs` e `ui/catalog.json`. `check:ui` detecta divergências entre fontes e artefatos instalados.

## Tema, idioma e acessibilidade

`SuperPreferences.bindTheme(element, onChange?)` aplica `data-super-theme` e retorna a função de descarte. O tema sistema acompanha mudanças do sistema operacional. A preferência de idioma mantém a chave `tabliss/config/locale`; os módulos observam o mesmo valor. Textos permanecem nos catálogos existentes.

Rótulos e campos preservam associações, IDs, atributos ARIA, estados desabilitados e tipos de botão. O foco tem contorno interno; buscas compostas possuem um único contorno. A escala usa espaços de 4, 8, 12, 16 e 24 px, campos de 40 px e botões de pelo menos 36 px. Navegação e alça de redimensionamento permanecem fora da rolagem.

## Verificação

Os testes de contrato cobrem semântica HTML, formulários, conteúdo escapado, estados desabilitados, referências e `v-model` no Vue, valores controlados no React e correspondência dos artefatos estáticos. Os testes existentes cobrem navegação, idiomas, perfis, rascunhos, autorização, backup, regras e estados da VPN. O teste de logs aceita LF e CRLF, respeitando a exportação nativa do Windows.

Veja [validacao.md](validacao.md) para resultados e limites da conferência no navegador. Testes DOM não comprovam geometria nem autenticação ou tráfego real.
