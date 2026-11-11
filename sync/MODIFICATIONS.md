# Estado atual — Super Extensão 1.6.3

A interface ativa continua em `sync/source`. Perfis Google Drive de favoritos passam a executar o núcleo próprio em `sync/engine`; os demais provedores e perfis de abas mantêm o motor legado. O painel de comparação foi removido. Cadastro, OAuth interativo, formato dos perfis e agendamento permanecem na camada de compatibilidade.

O núcleo e seu worker são compilados por `npm run build:sync-engine`; a interface por `npm run build:sync`. Os componentes derivados do Floccus e seus avisos MPL-2.0 permanecem preservados.

Documentação: [interface](../docs/sync-interface.md), [novo núcleo](../docs/sync-engine.md), [roteiro](../PROXIMOS-PASSOS.md) e [validação](../docs/validacao.md). Licença MPL-2.0, fontes e avisos dos componentes derivados permanecem preservados. As instruções antigas abaixo são históricas; a interface atual é reconstruída por `npm run build:sync`, na raiz, após os comandos de preparo documentados.

## Histórico da interface própria

### Interface própria — Super Extensão 1.5.9

A interface ativa agora é compilada de `sync/source`, com navegação Perfis/Novo perfil/Backup/Conexões, cartões de perfil, busca, assistente com seleção visual de serviços e formulários adaptados ao tema compartilhado. Mantém componentes e fluxos derivados do Floccus sob MPL-2.0, com fonte original e avisos preservados. Motor, conectores, armazenamento e worker permanecem nesta etapa.

Reconstrução atual: `npm ci`, `npm run setup:sync`, `npm run setup:vpn`, `npm run build:sync` e `npm test`, na raiz. Os bundles da interface não devem mais ser substituídos pela compilação das telas antigas. Veja `docs/sync-interface.md` para arquitetura, compatibilidade e limites da validação.

## Histórico da integração

### Integração de sincronização — Super Extensão 1.4.0

Base: Floccus 5.13.0, commit 05decdc731415cab2614bf8cf240833b815e7e30.
Fonte: https://github.com/floccusaddon/floccus
Licença: MPL-2.0; autores e demais avisos preservados no código-fonte e nos arquivos .LICENSE.txt dos bundles.

Alterações: interface e marca próprias, temas compartilhados, catálogos somente EN e PT-BR completos, isolamento de armazenamento/alarmes/mensagens, remoção de doações e navegações automáticas do original, preservação do ícone principal, configuração OAuth própria, tratamento de erros na comunicação e adaptação dos caminhos de recursos.

Para recompilar: em vendor/floccus-source, execute npm ci --ignore-scripts e npx webpack --config webpack.super.cjs. Copie dist-super/js para sync/js e super-theme.css para sync/theme.css na raiz da extensão. Não copie node_modules para a extensão distribuída. O HTML é sync/html/options.html. As credenciais JSON da origem foram substituídas por modelos vazios; configure OAuth pela interface, sem incluí-las no repositório.

Versão 1.4.1: largura e bordas compartilhadas entre cabeçalho, conexão, cartões, assistente e opções; controles superiores agrupados; campos contidos e layout responsivo.

Versão 1.4.3: incorporação do aplicativo na seção Sincronização. sync/embedded.js identifica o contexto incorporado e mantém as rotas internas no mesmo quadro; o tema adapta cabeçalho, navegação, formulários e espaçamento para a largura do popup. A página independente continua disponível e as chaves de armazenamento existentes foram mantidas.

Na versão 1.5.6, o aplicativo monta suas rotas no elemento da seção Sincronização do popup. A compilação gera `options.css` ao lado do JavaScript. Depois de copiar os arquivos para `sync/js`, execute `npm run build:panels` na raiz para atualizar os estilos da interface integrada.

## 1.6.1 — Sincronização da raiz

Removida a restrição que impedia perfis do Google Drive com a raiz geral do navegador. O motor preserva as pastas permanentes e sincroniza seu conteúdo, reutilizando os mapeamentos e o cache do motor anterior. Os títulos das pastas especiais são normalizados para compatibilidade entre idiomas, sem renomeá-las no navegador. Testes cobrem migração, idempotência, download, organização do remoto e proteção das pastas nativas.

## 1.6.2 — Requisições Google e arquivo de diagnóstico

A implementação padrão de fetch permanece vinculada ao contexto global do worker. Falhas de transporte agora têm código próprio e identificam a etapa (autenticação, listagem, leitura, metadados, bloqueio ou escrita), com status HTTP quando disponível. Os logs incluem somente categorias fixas da exceção, sem URL, corpo, mensagem bruta ou credenciais. A exportação usa `super-extensao-sincronizacao-<versão>-<data>-completo.log` ou `-anonimizado.log`, cabeçalho próprio e a versão instalada da extensão; a anonimização existente foi preservada.

## 1.6.3 — Manutenção da interface compartilhada

O adaptador de tema usa `SuperPreferences.bindTheme` e mantém a integração com o Vuetify. A base compartilhada centraliza o foco interno, evita o contorno duplicado em buscas compostas e permite quebra de textos longos nos controles comuns. A matriz DOM de tema/idioma mantém rascunhos e configurações. A documentação distingue o relato de sincronização bem-sucedida na 1.6.2 dos cenários reais ainda não verificados.
