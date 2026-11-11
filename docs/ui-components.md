# Base visual e idioma compartilhados — referência 1.5.19

`ui-components.css` reúne as primitivas reutilizáveis da extensão. `ui-theme.css` carrega essa base e define cores, família tipográfica e raios; `ui-components.css` define a escala de tamanhos e espaçamento. Os componentes optam por classes `ui-*`, para evitar alterar indiscriminadamente os formulários herdados do motor de sincronização.

- `ui-header-controls`: grupo de seletores do cabeçalho.
- `ui-field` e `ui-field-compact`: rótulo e campo, com espaçamento consistente.
- `ui-select`: seletor nativo com as cores e bordas da extensão.
- `ui-button` e `ui-card`: bases visuais para botões e cartões.
- `ui-scroll-panel`: área rolável sem barra visível.

Tema e Idioma usam essa base no cabeçalho global. Os botões e cartões da VPN também adotam as classes comuns. Os painéis existentes continuam com seus fluxos e validações. Botões, campos nativos, buscas, switches, cartões, contadores e avisos das abas usam essas primitivas. Os formulários Vuetify recebem um adaptador para a mesma escala visual, preservando validações e comportamento.

O contorno de foco continua ativo e usa deslocamento interno para permanecer inteiro mesmo em áreas que recortam o conteúdo. A mesma geometria é aplicada ao editor da Nova guia.

## Idioma

A única preferência de idioma é `SuperPreferences.locale`, mantendo a chave `tabliss/config/locale`. O seletor global grava essa preferência; Sincronização, VPN e Nova guia continuam observando o mesmo valor. O seletor da Sincronização e o da conta VPN ficam disponíveis somente nas páginas independentes, quando não há cabeçalho global.

Textos fixos do popup e da aba de reserva usam `data-i18n`, com atributos correspondentes para título, descrição acessível e placeholder. Mensagens dinâmicas, contagens, confirmações, datas e notificações de limpeza usam `SuperI18n`. O serviço de limpeza recebe o idioma escolhido sem depender do idioma do navegador.

Edite `_locales/en/messages.json` e `_locales/pt_BR/messages.json`, mantendo as mesmas chaves. `i18n/literal-keys.json` associa os textos legados aos respectivos identificadores; não faz substituição no conteúdo do usuário. `i18n/runtime.js` é a fonte do tradutor, e `npm run build:i18n` gera `i18n.js`, incluído no repositório. Alterações na interface Vue exigem `npm run build:sync`; alterações na VPN exigem `npm run build:vpn-ui`.

O bloco de limpeza e o relatório ficam apenas nas seções de Limpeza. Autoplay e Abas mantêm suas mensagens de resultado fora desse bloco.

Os testes DOM verificam troca de idioma no cabeçalho e nos dois módulos incorporados, preservação de campos e configurações, contagens e mensagens dinâmicas, catálogos e placeholders das notificações. A validação visual e das notificações reais no navegador continua pendente no ambiente de desenvolvimento.

## Submenus fixos

Limpeza, Sincronização e VPN usam a mesma apresentação `sub-nav ui-submenu`, na área `.popup-navigation` fora da rolagem do conteúdo. Sincronização e VPN montam seus controles nos espaços `syncSubmenu` e `vpnSubmenu`, mantendo rotas, estado selecionado e idioma. Nas páginas independentes, a navegação permanece no próprio módulo.

Campos compostos, como a busca de perfis, usam `ui-focus-within`: o contorno é desenhado dentro do limite do contêiner, inclusive quando o foco está no input interno. Isso substitui a antiga regra externa `sync-search:focus-within` que podia ser recortada pelo painel.

## Escala e variantes

A Limpeza orienta a apresentação comum: controles de 40 px, botões de no mínimo 36 px, fonte de controle de 12 px, títulos de seção de 14 px, descrições de 11 px e cartões com 16 px de preenchimento. A escala de espaçamento usa 4, 8, 12, 16 e 24 px. As ações principais, controles compactos e cartões de boas-vindas têm variantes explícitas.

- `ui-button`, `ui-button-primary`, `ui-button-secondary`, `ui-button-danger`, `ui-button-compact`.
- `ui-control` para campos nativos; `ui-search` e `ui-focus-within` para buscas compostas.
- `ui-card`, `ui-count`, `ui-switch`, `ui-footer-note`.
- `ui-notice`, com `ui-notice-error`, `ui-notice-warning` ou `ui-notice-success`.

A configuração da Nova guia segue as mesmas dimensões, preservando a personalização do painel. Na compilação do popup, a base compartilhada é reaplicada dentro da Sincronização, depois do CSS do motor: isso impede que o reset do Vuetify apague o preenchimento, as bordas e as cores dos componentes nativos.

## Largura, setas e validação

Os painéis e filhos flex/grid têm limites de largura e permissão para encolher; o eixo horizontal dos painéis roláveis fica contido. Os países da VPN reservam uma caixa fixa de 16 px para o SVG `icons/chevron-right.svg`, com folga à direita; a rotação ocorre dentro da caixa. O foco continua interno. Esses ajustes foram implementados em 1.5.17/1.5.18 e precisam de conferência visual real nos estados aberto/fechado. Os testes DOM/CSS não substituem essa verificação. Veja [validacao.md](validacao.md).
