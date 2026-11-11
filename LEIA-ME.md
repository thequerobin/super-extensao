# Super Extensão 1.4.3

Versão separada, preparada para uso pessoal no Helium e em navegadores Chromium. A limpeza usa o worker adaptado da Auto Clear History on Exit 2.0.9 instalada no caminho informado. O ícone próprio é um S geométrico em roxo e turquesa, com fonte editável em `icons/super-icon.svg` e PNGs de 16, 32, 48 e 128 pixels. O controle de autoplay e a proteção da última aba foram reimplementados após a análise das extensões AutoplayStopper (MV3), ID `gcendpekmacfohmhhkbhejjfbepkkkib`, e Don't Close Window With Last Tab, ID `dlnpfhfhmkiebpnlllpehlmklgdggbhn`. Esta é uma extensão pessoal independente, sem vínculo com os desenvolvedores originais.

## Repositórios das extensões de origem

Verificado em 9 de novembro de 2026:

| Extensão | Identificador na loja | Repositório público confirmado |
| --- | --- | --- |
| Auto Clear History on Exit (Kuuloa) | `hfdaikgklefacppkadgkncadaoehnlla` | Não foi encontrado um GitHub público confirmado. A análise e a adaptação usaram os arquivos da instalação local, versão 2.0.9. |
| AutoplayStopper (MV3) | `gcendpekmacfohmhhkbhejjfbepkkkib` | [kenijo/AutoplayStopperMV3](https://github.com/kenijo/AutoplayStopperMV3) |
| Don't Close Window With Last Tab | `dlnpfhfhmkiebpnlllpehlmklgdggbhn` | [moneytoo/DontCloseWindowWithLastTab](https://github.com/moneytoo/DontCloseWindowWithLastTab) |
| Tabliss | `hipekcciheckooncpjeljhnekcoolahp` | [joelshepherd/tabliss](https://github.com/joelshepherd/tabliss) — versão integrada: 2.6.0 |
| Floccus | `fnaicdffflnofjppbagibeoednhnbjhg` | [floccusaddon/floccus](https://github.com/floccusaddon/floccus) — versão integrada: 5.13.0 (MPL-2.0) |

A ausência de um repositório confirmado para a extensão de limpeza não significa que ele não exista; apenas não foi localizado na verificação acima.


## Instalar no Helium

1. Guarde esta pasta em um local permanente. Se recebeu o ZIP, extraia-o primeiro.
2. Abra `chrome://extensions/` no Helium.
3. Desative as extensões originais de limpeza, autoplay, proteção de abas e Tabliss antes de ativar esta versão, para evitar rotinas duplicadas e disputa pela Nova guia. Não é necessário desinstalá-las.
4. Ative **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação** e selecione a pasta que contém este `manifest.json`.
6. Abra **Super Extensão** pelo menu de extensões e configure suas preferências.

Se esta pasta já estava carregada, clique em **Recarregar** no cartão da extensão. As novas funções usam a permissão `tabs` e scripts em páginas HTTP/HTTPS. O navegador pode pedir que você confirme as novas permissões ou reative a extensão. Recarregue os sites que já estavam abertos para injetar o controle de autoplay. As configurações existentes de limpeza permanecem salvas.

A versão 1.2.0 também define uma Nova guia personalizada. Abra uma nova aba após recarregar e aceite a alteração de Nova guia se o navegador solicitar.

## Nova guia Tabliss completa

O dashboard Tabliss 2.6.0 foi incorporado com editor de fundos, todos os widgets originais da versão, suas configurações, traduções e importação/exportação. O fundo inicial é um gradiente local; Unsplash, GIPHY, cores e imagens próprias continuam disponíveis na engrenagem do Tabliss. Essa engrenagem ajusta a página; o botão **Super Extensão**, no canto superior direito, abre os controles de limpeza, autoplay e abas.

Para migrar sua personalização, exporte as configurações na extensão Tabliss original, depois desative-a e importe o JSON nas configurações da página integrada. A importação nativa substitui as configurações da Nova guia. Imagens próprias não estão incluídas no JSON do Tabliss e devem ser selecionadas novamente. O perfil original e sua configuração não são lidos automaticamente.

As configurações do dashboard usam o namespace `tabliss/config` em `storage.sync` e podem sincronizar quando o navegador oferecer esse recurso. O cache e as imagens próprias ficam no IndexedDB, separados das preferências locais de limpeza, autoplay e abas. A limpeza não solicita remoção de dados de extensões.

O componente mantém sua licença GPL-3.0, avisos e código-fonte em `vendor/tabliss-source`. Os detalhes das adaptações estão em `newtab/MODIFICATIONS.md`. O envio de erros ao Sentry foi desativado.

Na versão 1.2.1, o painel de Nova guia passou a usar a logo, o espaçamento e os temas da Super Extensão. Os blocos finais de persistência, doação, links e crédito de tradução foram removidos da interface. Importação/exportação/reset e os controles de fundos e widgets permanecem disponíveis.

Na versão 1.3.0, os controles, dicas e mensagens do dashboard foram traduzidos para português do Brasil, incluindo fundos, widgets, ícones, busca, clima, relógio e tarefas. O seletor oferece somente **Português do Brasil** e **English**. Preferências antigas em português de Portugal ou idiomas removidos são migradas para PT-BR; variantes de inglês usam English. Personalizações, notas, imagens e atalhos são preservados. Os catálogos excedentes foram removidos do código-fonte e do pacote compilado.

A identidade desta versão é diferente da original: não há chave da loja nem URL de atualização. As configurações da extensão original não são importadas automaticamente. Na primeira instalação, apenas a exclusão do histórico fica ativada.

## Novidades

- Tema escuro por padrão, com opções Claro e Sistema. A preferência é salva localmente.
- Uma única lista de exceções, **somente para cookies**, conforme o escopo final solicitado.
- Importação manual dos domínios de uma pasta de favoritos, com escolha de subpastas, prévia e remoção de duplicados. A importação é manual; a permissão de favoritos também atende ao módulo de sincronização.
- Interface em português, relatório da última limpeza, modos Seguro/Padrão/Forte, pausa, retomada e limpeza manual.
- Sem pedidos de avaliação do desenvolvedor original.
- Aba **Autoplay**: liga/desliga, padrão global, regra para o site atual, regras por domínio/subdomínio, busca, exportação e importação JSON. Aceita os arquivos de regras do AutoplayStopper original e listas antigas de domínios permitidos. A importação mescla regras, sem apagar outras; em caso de mesmo domínio, a regra importada prevalece.
- Aba **Abas**: preserva a janela ao fechar a última aba, com escopos última janela, primeira janela/última restante e todas. Oferece Nova guia única por janela e sua movimentação para a última posição.

## Exceções e favoritos

Na aba **Exceções**, adicione um domínio ou uma URL. Caminhos e parâmetros são descartados. Também é possível abrir **Favoritos**, escolher uma pasta, conferir a prévia e clicar em **Importar domínios**.

A importação adiciona domínios à lista existente, não substitui a lista e não altera os favoritos. Ela não acompanha mudanças posteriores nas pastas. Links que não usam HTTP/HTTPS são ignorados. Você pode remover cada exceção individualmente.

A API protege cookies para o domínio registrável inteiro. Por exemplo, adicionar `accounts.exemplo.com` preserva também os cookies de `exemplo.com` e seus subdomínios. As exceções **não protegem cache nem armazenamento local**; portanto, não garantem a preservação de todos os logins quando outros tipos de dados são apagados.

## Comportamento de limpeza

- Seguro: histórico. Padrão: histórico e cache. Forte: todos os seis tipos disponíveis.
- Ao fechar a última janela, a extensão tenta executar a limpeza. Se o navegador encerrar antes, tenta novamente na próxima abertura.
- Uma limpeza só é registrada como concluída após as APIs de remoção terminarem com sucesso.
- **Limpar agora** funciona mesmo com a automação pausada ou desativada.
- O histórico de downloads é apagado somente se selecionado; os arquivos baixados permanecem no disco.
- Armazenamento local significa `localStorage`. IndexedDB, Cache Storage de service workers e outros armazenamentos não foram adicionados ao escopo.
- Senhas salvas não são apagadas. A limpeza do histórico local não apaga o histórico da Conta Google.

## Permissões e privacidade

`browsingData` executa a limpeza; `storage` guarda preferências e relatórios; `alarms` controla pausas; `notifications` informa resultados; `background` mantém o comportamento de execução em segundo plano quando permitido pelo navegador. `tabs` permite identificar o site atual e gerenciar abas. Os scripts em HTTP/HTTPS controlam reprodução de vídeo e áudio, inclusive em quadros e shadow DOM. `bookmarks` permite a sincronização e a importação manual de domínios. As rotinas de limpeza, autoplay e abas não enviam dados a servidores nem modificam favoritos. Provedores e widgets online da Nova guia fazem requisições aos serviços escolhidos, como Unsplash, GIPHY e serviços de clima, e dependem da disponibilidade desses serviços. A sincronização da Nova guia depende do suporte do navegador; imagens próprias não sincronizam.

## Autoplay e proteção de abas

O autoplay começa ativado e com padrão **Bloquear**. As regras valem para o domínio e seus subdomínios, dando prioridade à regra mais específica. Um clique, toque ou tecla real dentro da página libera mídia nesse quadro até a próxima navegação. Eventos sintetizados pelo site não contam. Cada quadro usa as regras do próprio domínio. Permitir autoplay na extensão não contorna as restrições nativas do navegador. Páginas internas e páginas protegidas da loja não aceitam os scripts.

A proteção da última aba começa ativada, apenas para a última janela normal restante. Ela mantém uma aba de reserva fixada, criada pela própria extensão, e abre uma Nova guia quando você fecha a última aba de conteúdo. A reserva é retirada quando existem outras abas suficientes. Somente reservas identificadas como criadas pela extensão podem ser removidas por essa rotina; abas fixadas pelo usuário permanecem intactas. Se você navegar ou desafixar uma reserva, ela passa a ser tratada como sua aba.

Para realmente fechar o navegador, use o X da janela ou a opção Sair. A proteção não deve impedir esse fechamento. A limpeza só começa quando não há mais janelas abertas. Para o modo anônimo, autorize a extensão separadamente nas configurações do navegador. A opção de Nova guia única reconhece os endereços internos de Nova guia; páginas externas usadas como página inicial não são excluídas como duplicadas.

## Verificação

Passaram 16 testes automatizados isolados para limpeza, domínios/favoritos, recuperação de falhas, regras de autoplay, transições de abas e integridade dos catálogos bilíngues. A revisão de navegador também confirmou migração de idioma, alternância PT-BR/English, controles dos widgets e preservação de notas escritas pelo usuário. O teste de interface utiliza favoritos fictícios e APIs simuladas e confere temas, navegação, domínios, favoritos, limpeza, autoplay e controles de abas.

A extensão também foi carregada no Edge com um perfil temporário novo: o popup abriu sem erros, a permissão de favoritos era opcional antes do módulo de sincronização e a API real preservou um cookie de teste em `example.com`, apagando outro em `example.org`. Nenhum dado do perfil do usuário foi apagado durante o desenvolvimento. As imagens de prévia fornecidas foram geradas com dados fictícios.

No navegador isolado, passaram ainda os testes reais de autoplay nativo e por script, clique real/sintético, regras e liga/desliga em tempo real, mídia em shadow DOM, reserva ao fechar a última aba, retirada da reserva, Nova guia única/última posição e preservação de abas fixadas pelo usuário. O fechamento nativo de janela não pôde ser validado no Edge headless deste ambiente: `windows.remove()` não fechou a janela de teste. A lógica dos eventos de fechamento foi validada isoladamente; confirme o X da janela no Helium após instalar.

O teste final de encerramento e reabertura no Helium depende do comportamento do navegador e deve ser conferido após a instalação. Não há garantia de concluir a limpeza antes do encerramento do processo.

Também passaram os testes reais do dashboard em um perfil temporário do Edge com rede externa bloqueada: abertura por `chrome://newtab/`, editor completo, cinco provedores disponíveis, notas, upload e persistência de imagem, importação/exportação e integração com limpeza e organização de abas. O uso ao vivo de provedores e widgets externos não foi validado nesses testes offline.

Referências das APIs: https://developer.chrome.com/docs/extensions/reference/api/browsingData e https://developer.chrome.com/docs/extensions/reference/api/bookmarks.

## Sincronização de favoritos

Abra **Sincronização** no menu principal. A interface própria reúne **Perfis**, **Novo perfil**, **Backup** e **Conexões**, com busca, status e ações de sincronização. O assistente oferece os oito serviços existentes e as opções continuam disponíveis no próprio perfil. A navegação interna permanece no painel, sem abrir outra guia. Adicione um perfil, escolha um serviço, a pasta local e a estratégia. O motor é baseado no [Floccus 5.13.0](https://github.com/floccusaddon/floccus/tree/v5.13.0), com interface própria, PT-BR e inglês. Perfis e credenciais da extensão original não são importados automaticamente.

Estão disponíveis os conectores do Floccus para WebDAV, Nextcloud Bookmarks, Google Drive, Dropbox, S3, Git, Linkwarden e Karakeep, além das opções de sincronização de abas, agendamento, criptografia compatível com o conector e importação/exportação de perfis. A estratégia padrão mescla alterações; estratégias de substituição devem ser escolhidas conscientemente.

**Google Drive e Dropbox:** abra a tela **Conexões** e informe credenciais OAuth próprias, cadastradas para o endereço de redirecionamento mostrado pela extensão. O cliente OAuth e o identificador do Floccus original não são reutilizados. O Google usa ID e chave secreta do cliente; o Dropbox usa a chave do aplicativo. WebDAV, Nextcloud, S3 e os demais conectores usam as configurações de seus próprios perfis.

O idioma acompanha a preferência PT-BR/inglês da nova guia e o tema acompanha o painel principal. O módulo usa chaves `superSync:` e alarmes/mensagens `super-sync`, sem substituir regras de autoplay, exceções de cookies, preferências da nova guia ou o ícone principal.

As permissões adicionais são `bookmarks` (ler e modificar as pastas escolhidas), `unlimitedStorage` (cache de sincronização), `tabGroups` (sincronização opcional de abas) e `identity` (login OAuth). `history` é opcional e usado somente se o usuário ativar contagem de visitas em um conector compatível. O acesso aos favoritos passa a ser obrigatório para o módulo; importar domínios para exceções continua sendo uma ação manual independente.

Interface ativa: `sync/source`, compilada com `npm run build:sync`. O motor e sua fonte adaptada continuam em `vendor/floccus-source`. [Reconstrução e validação da interface](docs/sync-interface.md). Licença MPL-2.0 e alterações: `sync/LICENSE.txt` e `sync/MODIFICATIONS.md`. Este projeto não é uma publicação oficial do Floccus. As credenciais ficam no armazenamento local da extensão; a exportação de perfis pode conter segredos e deve ser guardada como uma configuração privada.


Na versão 1.4.0, o painel de sincronização foi testado em um perfil temporário novo do Edge: PT-BR/inglês, temas claro/escuro, assistente de perfis, erro de OAuth não configurado, envio e recebimento reais de favoritos fictícios usando um servidor WebDAV local, além de limpeza com cookies preservados e configuração de sincronização intacta. Nenhum perfil, conta ou favorito real foi usado. Login e sincronização com serviços externos reais ainda dependem da configuração do usuário e não foram validados com contas de nuvem.

Na versão 1.4.2, o menu principal reúne Limpeza, Autoplay, Abas e Sincronização. Limpeza contém os submenus O que apagar, Cookies e Favoritos, preservando a seleção ao trocar de seção. Na versão 1.4.3, Sincronização incorpora o painel completo na própria seção, sem botão de redirecionamento.

Versão 1.4.3: painel de sincronização incorporado ao popup, com navegação interna, tema compartilhado e altura ajustada ao espaço disponível. Conferido no popup nativo do Edge e com perfis fictícios: criação, opções e importação/exportação permaneceram dentro da seção, sem abrir novas guias. O login nos provedores continua usando a janela de autorização do serviço. As configurações existentes permanecem no armazenamento da extensão.
