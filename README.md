# Super Extensão

<img src="icons/icon128.png" width="88" height="88" alt="Ícone da Super Extensão">

Uma extensão para Helium e navegadores Chromium que reúne a Nova guia personalizada, sincronização de favoritos, limpeza ao sair, controle de reprodução automática e proteção da última aba. Interface em português do Brasil, com temas escuro, claro e do sistema; o dashboard oferece somente **PT-BR e inglês**.

## Recursos

**Interface da VPN (1.5.10):** telas próprias de Conexão, Servidores, Recursos e Conta, com tema e idioma compartilhados. O motor Proton é mantido, assim como sessões, regras e restrições de plano. O controle de limpeza ao fechar fica acima do relatório de última limpeza, e todas as abas usam o mesmo espaçamento do cabeçalho. [Detalhes e validação pendente](docs/vpn-interface.md).

**Proton VPN integrado (1.5.0):** abra a aba **VPN**, entre na sua conta Proton e selecione um servidor permitido pelo seu plano. Contas Free usam o seletor completo para os servidores gratuitos disponíveis. Tunelamento dividido permite excluir sites da VPN ou usar a VPN apenas nos sites escolhidos, incluindo subdomínios. O tema é compartilhado com o painel principal. O proxy cobre o navegador e depende da autorização da API Proton. Login e conexão real ainda precisam de validação. [Detalhes da integração](vpn/INTEGRACAO.md).

- **Nova guia completa:** Tabliss 2.6.0 com editor de fundos, widgets, traduções, importação/exportação, imagens próprias, cores, gradientes, Unsplash e GIPHY. Fundo inicial local e envio de erros ao Sentry desativado.
- **Painel unificado:** marca da Super Extensão, largura de 460 px e temas Escuro/Claro/Sistema sincronizados com o popup. Os blocos finais de persistência, apoio e links sociais foram removidos da interface.
- **Tradução completa dos controles:** fundos, widgets, dicas, mensagens, ícones e seletores em PT-BR, com inglês preservado. Idiomas excedentes foram removidos e preferências antigas são migradas sem apagar personalizações.
- **Limpeza:** histórico, cache, cookies, histórico de downloads, formulários e localStorage. Modos Seguro, Padrão e Forte, pausa temporária, limpeza manual e relatório do último resultado.
- **Cookies:** exceções por domínio e importação de domínios de uma pasta dos favoritos, com prévia, subpastas opcionais e deduplicação. As exceções se aplicam somente a cookies.
- **Autoplay:** liga/desliga, padrão global, regras por site e subdomínio, ajuste do site atual, busca e importação/exportação JSON.
- **Abas:** proteção da última aba por meio de uma reserva fixada, seleção das janelas protegidas, Nova guia única e opção de mantê-la na última posição.
- **Ícone próprio:** S geométrico em roxo e turquesa, com SVG editável e PNGs de 16, 32, 48 e 128 pixels.

## Instalação sem compactação

1. Baixe o repositório em **Code → Download ZIP** e extraia os arquivos, ou clone:

   ```sh
   git clone https://github.com/thequerobin/super-extensao.git
   ```

2. Abra `chrome://extensions/` no navegador.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta que contém `manifest.json`.
5. Recarregue as páginas já abertas para ativar o controle de autoplay nelas. Abra uma nova guia para acessar o Tabliss integrado e aceite a alteração de Nova guia se o navegador solicitar.

Não há compilação nem instalação de dependências para usar a extensão. Mantenha a pasta no mesmo local. Após atualizar os arquivos, clique em **Recarregar** no cartão da extensão. Se usar as extensões originais descritas nos créditos, desative-as para evitar rotinas duplicadas.

## Como funciona

### Nova guia Tabliss

A engrenagem do dashboard abre o editor de fundos e widgets com o visual da Super Extensão. O botão **Super Extensão** no canto superior direito abre os controles de limpeza, autoplay e abas. Para transferir a personalização de uma instalação separada do Tabliss, exporte o JSON nela e importe na página integrada. A importação substitui as configurações da Nova guia; imagens próprias devem ser selecionadas novamente porque não fazem parte do JSON original.

O gradiente inicial funciona offline. Widgets e provedores online continuam disponíveis e dependem dos respectivos serviços, suas APIs e cotas. As preferências do dashboard usam `tabliss/config` em `storage.sync` e podem sincronizar se o navegador oferecer o recurso. Imagens e cache usam IndexedDB e não sincronizam. Esses dados ficam separados das preferências locais de limpeza/abas/autoplay e não são apagados pela limpeza configurada nesta extensão.

O tema é compartilhado entre o popup, a nova guia, a sincronização e a VPN. O idioma escolhido na nova guia ou na sincronização também se aplica à VPN, que recarrega seu painel ao mudar de idioma. O arquivo `preferences.js` centraliza a leitura, a validação e as atualizações dessas preferências com as chaves já usadas pelas instalações existentes.

A VPN e a sincronização montam todas as suas telas na página do popup. A interface usa os dados locais e as consultas dos próprios módulos para carregar perfis, sessões e servidores. Os estilos são limitados ao painel de cada módulo. Para recompilar a interface da sincronização, use `npm run build:sync`; o comando também atualiza os estilos compartilhados dos painéis. A compilação da VPN já executa essa etapa.

O componente GPL-3.0 mantém licença, avisos e código-fonte. Veja [as adaptações e instruções de reconstrução](newtab/MODIFICATIONS.md) e [o código-fonte correspondente](vendor/tabliss-source/).

### Limpeza e exceções

Por padrão, apenas a exclusão do histórico está habilitada. A limpeza é tentada ao fechar a última janela; se o processo encerrar antes de concluir, a extensão tenta novamente na próxima abertura. O resultado só é registrado como concluído após as APIs de remoção terminarem com sucesso.

Exceções preservam cookies do domínio registrável inteiro, incluindo seus subdomínios. Elas **não preservam cache nem localStorage**. Por isso, não garantem a manutenção de todos os logins se outros dados de sites também forem apagados. Senhas salvas e arquivos baixados são preservados. O histórico da Conta Google não é apagado.

A importação de favoritos adiciona os domínios à lista existente. Ela não altera os favoritos nem acompanha mudanças futuras na pasta. Links fora de HTTP/HTTPS são ignorados.

### Autoplay

O controle inicia ativado, com padrão **Bloquear**. A regra mais específica para o domínio/subdomínio tem prioridade. Uma interação real na página libera a reprodução naquele quadro até a próxima navegação; cliques sintetizados pelo site não contam. Cada quadro usa as regras do próprio domínio. Permitir na extensão não contorna as restrições nativas do navegador.

Páginas internas e outras páginas protegidas pelo navegador não aceitam os scripts de controle. O comportamento pode variar em players e páginas que substituem as APIs de mídia.

### Última aba

A proteção inicia ativada, para a última janela normal restante. Uma aba de reserva é criada quando necessária e retirada quando há outras abas suficientes. Somente reservas criadas e identificadas pela extensão são removidas por essa rotina. Abas fixadas pelo usuário são preservadas.

**Para encerrar e executar a limpeza ao sair, feche a janela pelo X ou saia do navegador.** Fechar a última aba de conteúdo pode manter a janela aberta intencionalmente. O uso no modo anônimo exige a autorização separada do navegador.

## Permissões e privacidade

| Permissão | Uso |
| --- | --- |
| `browsingData` | Executar a limpeza selecionada. |
| `storage` | Salvar configurações e relatórios locais; identificar reservas durante a sessão. |
| `alarms` | Retomar a automação após uma pausa. |
| `notifications` | Exibir resultados da limpeza. |
| `background` | Manter o comportamento em segundo plano quando permitido pelo navegador. |
| `tabs` | Identificar o site atual e gerenciar abas. |
| HTTP/HTTPS e content scripts | Controlar mídia nas páginas e seus quadros. |
| `bookmarks` | Sincronizar as pastas escolhidas e importar domínios para exceções. |
| `unlimitedStorage`, `tabGroups`, `identity` | Cache de sincronização, grupos de abas e login OAuth. |
| `history` — opcional | Contagem de visitas em conectores compatíveis, quando ativada. |

As rotinas de limpeza, autoplay e abas não enviam dados a servidores e não modificam favoritos. Os scripts das páginas recebem somente o estado de bloqueio de autoplay; não recebem listas de cookies, favoritos nem relatórios de limpeza. Os provedores e widgets online do dashboard fazem requisições aos serviços escolhidos, como Unsplash, GIPHY e serviços de clima. A sincronização de suas preferências depende do navegador; imagens próprias não sincronizam. O envio de erros do Tabliss ao Sentry foi desativado.

## Testes

Com Node.js 20 ou superior:

```sh
npm test
```

Não é necessário executar `npm install`: os testes usam módulos nativos do Node. A suíte cobre limpeza, exceções, favoritos, pausa, falhas e recuperação, regras de autoplay e transições de abas, com APIs de navegador simuladas.

A suíte Node tem 19 testes, incluindo isolamento do armazenamento da sincronização e integridade das traduções. As funções de limpeza, cookies, autoplay e abas também foram verificadas em um perfil temporário do Edge. Passaram ainda os testes offline da Nova guia real, editor, provedores, notas, imagem própria, importação/exportação, limpeza e organização de abas. Na versão 1.3.0, foram conferidos a migração de português de Portugal para PT-BR, os dois únicos idiomas disponíveis, a troca de idioma em tempo real e os controles dos widgets, sem alterar notas do usuário. Os testes de navegador executados durante o desenvolvimento não estão incluídos nesta suíte Node. O funcionamento ao vivo dos serviços externos não foi validado por esses testes offline.

O fechamento nativo pelo X e a recuperação após encerrar o processo ainda precisam ser conferidos no Helium. O ambiente Edge headless usado nos testes não fechou a janela por `windows.remove()`. Não há garantia de concluir a limpeza antes do encerramento do navegador.

## Créditos

### Repositórios das extensões de origem

Verificado em 9 de novembro de 2026:

| Extensão | Identificador na loja | Repositório público confirmado |
| --- | --- | --- |
| Auto Clear History on Exit (Kuuloa) | `hfdaikgklefacppkadgkncadaoehnlla` | Não foi encontrado um GitHub público confirmado. A análise e a adaptação usaram os arquivos da instalação local, versão 2.0.9. |
| AutoplayStopper (MV3) | `gcendpekmacfohmhhkbhejjfbepkkkib` | [kenijo/AutoplayStopperMV3](https://github.com/kenijo/AutoplayStopperMV3) |
| Don't Close Window With Last Tab | `dlnpfhfhmkiebpnlllpehlmklgdggbhn` | [moneytoo/DontCloseWindowWithLastTab](https://github.com/moneytoo/DontCloseWindowWithLastTab) |
| Tabliss | `hipekcciheckooncpjeljhnekcoolahp` | [joelshepherd/tabliss](https://github.com/joelshepherd/tabliss) — versão integrada: 2.6.0 |
| Floccus | `fnaicdffflnofjppbagibeoednhnbjhg` | [floccusaddon/floccus](https://github.com/floccusaddon/floccus) — versão integrada: 5.13.0 (MPL-2.0) |

A ausência de um repositório confirmado para a extensão de limpeza não significa que ele não exista; apenas não foi localizado na verificação acima.


O worker de limpeza e as traduções foram adaptados da [Auto Clear History on Exit 2.0.9](https://chromewebstore.google.com/detail/auto-clear-history-on-exi/hfdaikgklefacppkadgkncadaoehnlla), de Kuuloa.

As funções de autoplay e proteção da última aba foram reimplementadas após a análise de [AutoplayStopper (MV3)](https://chromewebstore.google.com/detail/autoplaystopper-mv3/gcendpekmacfohmhhkbhejjfbepkkkib) e [Don't Close Window With Last Tab](https://chromewebstore.google.com/detail/dont-close-window-with-last/dlnpfhfhmkiebpnlllpehlmklgdggbhn). Este projeto é independente e não é uma versão oficial dessas extensões.

A página Nova guia incorpora [Tabliss 2.6.0](https://github.com/joelshepherd/tabliss/tree/2.6.0), de Joël Shepherd e colaboradores, com licença GPL-3.0, avisos de dependências e código-fonte incluídos. As modificações da integração são identificadas em `newtab/MODIFICATIONS.md`; esta não é uma publicação oficial do Tabliss.

## Sincronização de favoritos

Abra **Sincronização** no menu principal. A interface própria reúne **Perfis**, **Novo perfil**, **Backup** e **Conexões**, com busca, status e ações de sincronização. O assistente oferece os oito serviços existentes e as opções continuam disponíveis no próprio perfil. A navegação interna permanece no painel, sem abrir outra guia. Adicione um perfil, escolha um serviço, a pasta local e a estratégia. O motor é baseado no [Floccus 5.13.0](https://github.com/floccusaddon/floccus/tree/v5.13.0), com interface própria, PT-BR e inglês. Perfis e credenciais da extensão original não são importados automaticamente.

Estão disponíveis os conectores do Floccus para WebDAV, Nextcloud Bookmarks, Google Drive, Dropbox, S3, Git, Linkwarden e Karakeep, além das opções de sincronização de abas, agendamento, criptografia compatível com o conector e importação/exportação de perfis. A estratégia padrão mescla alterações; estratégias de substituição devem ser escolhidas conscientemente.

**Google Drive e Dropbox:** abra a tela **Conexões** e informe credenciais OAuth próprias, cadastradas para o endereço de redirecionamento mostrado pela extensão. O cliente OAuth e o identificador do Floccus original não são reutilizados. O Google usa ID e chave secreta do cliente; o Dropbox usa a chave do aplicativo. WebDAV, Nextcloud, S3 e os demais conectores usam as configurações de seus próprios perfis.

O idioma acompanha a preferência PT-BR/inglês da nova guia e o tema acompanha o painel principal. O módulo usa chaves `superSync:` e alarmes/mensagens `super-sync`, sem substituir regras de autoplay, exceções de cookies, preferências da nova guia ou o ícone principal.

As permissões adicionais são `bookmarks` (ler e modificar as pastas escolhidas), `unlimitedStorage` (cache de sincronização), `tabGroups` (sincronização opcional de abas) e `identity` (login OAuth). `history` é opcional e usado somente se o usuário ativar contagem de visitas em um conector compatível. O acesso aos favoritos passa a ser obrigatório para o módulo; importar domínios para exceções continua sendo uma ação manual independente.

Interface ativa: `sync/source`, compilada com `npm run build:sync`. O motor e sua fonte adaptada continuam em `vendor/floccus-source`. [Reconstrução e validação da interface](docs/sync-interface.md). Licença MPL-2.0 e alterações: `sync/LICENSE.txt` e `sync/MODIFICATIONS.md`. Este projeto não é uma publicação oficial do Floccus. As credenciais ficam no armazenamento local da extensão; a exportação de perfis pode conter segredos e deve ser guardada como uma configuração privada.

Na versão 1.4.0, o painel de sincronização foi testado em um perfil temporário novo do Edge: PT-BR/inglês, temas claro/escuro, assistente de perfis, erro de OAuth não configurado, envio e recebimento reais de favoritos fictícios usando um servidor WebDAV local, além de limpeza com cookies preservados e configuração de sincronização intacta. Nenhum perfil, conta ou favorito real foi usado. Login e sincronização com serviços externos reais ainda dependem da configuração do usuário e não foram validados com contas de nuvem.

Versão 1.4.3: painel de sincronização incorporado ao popup, com navegação interna, tema compartilhado e altura ajustada ao espaço disponível. Conferido no popup nativo do Edge e com perfis fictícios: criação, opções e importação/exportação permaneceram dentro da seção, sem abrir novas guias. O login nos provedores continua usando a janela de autorização do serviço. As configurações existentes permanecem no armazenamento da extensão.


### Compilar o módulo VPN

O pacote carregável já inclui `vpn/`. Para reconstruí-lo após alterar o código:

```sh
npm ci
npm run setup:vpn
npm run build:vpn
npm test
```

A instalação do módulo usa `--legacy-peer-deps` devido ao conflito entre Babel 8 e a dependência de testes `ts-jest` herdado do upstream. Scripts de instalação das dependências ficam desativados. O código-fonte e a licença GPL-3.0 do Proton são preservados em `vendor/proton-source`.
