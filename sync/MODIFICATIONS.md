# Integração de sincronização — Super Extensão 1.4.0

Base: Floccus 5.13.0, commit 05decdc731415cab2614bf8cf240833b815e7e30.
Fonte: https://github.com/floccusaddon/floccus
Licença: MPL-2.0; autores e demais avisos preservados no código-fonte e nos arquivos .LICENSE.txt dos bundles.

Alterações: interface e marca próprias, temas compartilhados, catálogos somente EN e PT-BR completos, isolamento de armazenamento/alarmes/mensagens, remoção de doações e navegações automáticas do original, preservação do ícone principal, configuração OAuth própria, tratamento de erros na comunicação e adaptação dos caminhos de recursos.

Para recompilar: em vendor/floccus-source, execute npm ci --ignore-scripts e npx webpack --config webpack.super.cjs. Copie dist-super/js para sync/js e super-theme.css para sync/theme.css na raiz da extensão. Não copie node_modules para a extensão distribuída. O HTML é sync/html/options.html. As credenciais JSON da origem foram substituídas por modelos vazios; configure OAuth pela interface, sem incluí-las no repositório.

Versão 1.4.1: largura e bordas compartilhadas entre cabeçalho, conexão, cartões, assistente e opções; controles superiores agrupados; campos contidos e layout responsivo.

Versão 1.4.3: incorporação do aplicativo na seção Sincronização. sync/embedded.js identifica o contexto incorporado e mantém as rotas internas no mesmo quadro; o tema adapta cabeçalho, navegação, formulários e espaçamento para a largura do popup. A página independente continua disponível e as chaves de armazenamento existentes foram mantidas.
