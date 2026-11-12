# Super Extensão

<img src="icons/icon128.png" width="88" height="88" alt="Ícone da Super Extensão">

Extensão pessoal para Helium e navegadores Chromium, com Nova guia, sincronização de favoritos, VPN no navegador, limpeza ao sair, controle de autoplay e proteção da última aba.

**Versão instalada: 1.7.5.** Documentação revisada em 12 de novembro de 2026. Temas escuro, claro e sistema; idiomas PT-BR e inglês compartilhados entre os módulos. Requer Chromium 116 ou superior, conforme o manifest.

## Estado atual

| Área | Implementado | O que ainda depende de trabalho |
| --- | --- | --- |
| Interface | Catálogo comum com adaptadores HTML/DOM, Vue e React; páginas estáticas separadas em seções; preferências e foco compartilhados | Ampliar a conferência visual para todos os diálogos e estados com contas reais |
| Sincronização | Google Drive/favoritos pelo núcleo próprio; demais provedores e abas pelo motor legado | Dois navegadores reais, restauração de backups por interface e migração dos demais conectores |
| Núcleo Google Drive | Reconciliação, escrita condicional, criptografia, backup e retomada pelo diário | Ampliar a validação real relatada pelo usuário, medir grandes importações e suportar pastas sobrepostas |
| VPN | Interface, regras, controlador de proxy, estado/recuperação e persistência/rotação de tokens próprios | Validar login/tráfego/recuperação reais; extrair credenciais temporárias, transporte e WebRTC |
| Limpeza, Autoplay e Abas | Controles locais e testes automatizados | Validar fechamento nativo e recuperação no Helium |
| Nova guia | Tabliss adaptado, editor, widgets e importação/exportação | Regressão visual e teste dos provedores online utilizados |

O roteiro com prioridades e critérios de conclusão fica em [PROXIMOS-PASSOS.md](PROXIMOS-PASSOS.md). A cobertura e as limitações dos testes ficam em [docs/validacao.md](docs/validacao.md).

## Instalar ou atualizar

1. Baixe o repositório em **Code → Download ZIP** e extraia-o, ou clone:

   ```sh
   git clone https://github.com/thequerobin/super-extensao.git
   ```

2. Abra `chrome://extensions/`, ative **Modo do desenvolvedor** e escolha **Carregar sem compactação**.
3. Selecione a pasta que contém `manifest.json` e mantenha-a em um local permanente.
4. Após atualizar os arquivos, clique em **Recarregar** no cartão da extensão. Recarregue sites já abertos para aplicar os scripts de autoplay e abra uma Nova guia para carregar o dashboard atualizado.

Os arquivos compilados já estão no repositório: instalar a extensão não exige Node.js nem compilação. Desative outras extensões que executem as mesmas rotinas ou disputem a Nova guia e o proxy. Acesso em modo anônimo depende da autorização separada do navegador.

## Usar

### Preferências e navegação

Tema e idioma ficam no cabeçalho e atendem toda a extensão. Limpeza, Sincronização e VPN têm submenus fixos; o conteúdo interno continua rolável sem barras visíveis. Arraste a alça inferior para ajustar a altura do popup. A seção selecionada é preservada; a VPN também guarda sua página e rolagem.

A [biblioteca de componentes](docs/ui-components.md) centraliza estrutura, botões, campos, grupos de ações, cartões, avisos e espaçamento. Popup, sincronização, VPN, editor da nova guia e aba de reserva consomem essa base por seus adaptadores. React, Vue/Vuetify e os motores existentes permanecem; componentizar a interface não substitui esses motores.

### Sincronização de favoritos

Em **Sincronização → Novo perfil**, escolha o serviço e a pasta. O motor atual oferece os oito serviços da interface, favoritos ou abas conforme o perfil, agendamento, sincronização manual, backup de perfis e ações direcionais avançadas. Ações que substituem dados exigem atenção ao sentido escolhido.

Para Google Drive e Dropbox, configure credenciais OAuth próprias em **Conexões**, usando o endereço de redirecionamento exibido. O Google usa ID e segredo do cliente; o Dropbox usa a chave do aplicativo. Os outros conectores usam as configurações do perfil.

**Motor próprio Google Drive (1.6.3):** os perfis de favoritos usam `sync/engine` no botão **Sincronizar** e no agendamento existente. O núcleo faz leitura, reconciliação de três versões, escrita condicional, criptografia compatível, backup e aplicação local com checkpoints. Conflitos incompatíveis e exclusões grandes são interrompidos; as ações avançadas permitem escolher o sentido. O painel de comparação foi removido. Perfis com a raiz geral preservam as pastas permanentes e sincronizam seu conteúdo.

Os perfis existentes são aproveitados, incluindo cache e mapeamentos quando consistentes. Outros serviços e perfis de abas continuam no legado; cadastro, OAuth interativo e a estrutura de agendamento ainda usam a camada de compatibilidade. Pastas sobrepostas entre perfis são recusadas por enquanto. Os backups ficam no armazenamento local; ainda não há tela de restauração.

Veja [a interface e a compatibilidade](docs/sync-interface.md) e [o escopo do novo motor](docs/sync-engine.md). Perfis exportados podem conter credenciais; guarde esses arquivos como configurações privadas. Backup de perfis não equivale a backup dos favoritos.

### VPN

Abra **VPN** e entre na conta pela página oficial Proton. O proxy atende este navegador; a disponibilidade dos servidores e a autorização continuam sob controle do serviço e do plano da conta.

**Motor 1.7.4:** máquina de estados, restauração e novas tentativas próprias; operações de proxy ordenadas e confirmadas no navegador, descarte de conexões tardias após desconectar, recuperação por alarmes e persistência/rotação de tokens próprias. O login oficial e os adaptadores do serviço permanecem. [Arquitetura e limites](docs/vpn-engine.md).

Servidores ficam agrupados por país, inicialmente recolhidos, com bandeiras locais, filtros, pesquisa e carregamento em lotes. Os controles locais aparecem antes da busca de servidores terminar. Conta e plano também podem consultar a rede. Em **Recursos → Tunelamento dividido**, escolha excluir sites ou incluir somente os sites listados, com subdomínios opcionais.

Na **1.7.2**, abrir o painel consulta primeiro o estado real do worker e do proxy. Se a conexão já estiver confirmada, o cartão abre como conectado, sem inferir “conectando” de um servidor salvo; conta e servidores carregam separadamente. Não é guardada uma tela conectada em disco.

O ícone acompanha a aba:

- **Verde com visto:** conexão confirmada e endereço da aba roteado para a VPN.
- **Azul com traço:** conexão confirmada e endereço fora do túnel.
- **Ícone original:** sem conexão confirmada.

O sinal fica no canto superior direito, preservando o badge de limpeza pausada. Na 1.7.1, ele é reaplicado após navegação/recarregamento e ativação da aba, mesmo quando a cor continua igual; perda de controle do proxy restaura o ícone normal. Ele representa o roteamento configurado, sem medir tráfego ou verificar externamente o IP. Páginas internas não usam o túnel. Veja [uso e integração](docs/proton-vpn.md) e [interface, indicador e limites](docs/vpn-interface.md).

### Nova guia

Tabliss 2.6.0 adaptado, com editor de fundos e widgets, PT-BR/inglês, importação/exportação e fundo inicial local. A engrenagem abre o editor; o botão **Super Extensão** abre os controles da extensão. A importação substitui a configuração do dashboard; imagens próprias precisam ser selecionadas novamente.

Preferências usam `tabliss/config` em `storage.sync`; imagens e cache usam IndexedDB e não sincronizam pelo JSON. Unsplash/GIPHY permitem configurar a chave nas opções do fundo, salva apenas neste dispositivo; sem chave, exibem a orientação correspondente. [Carregamento de imagens e configuração](docs/newtab-images.md). Provedores online dependem dos serviços e de suas cotas. O envio de erros do Tabliss ao Sentry foi desativado. Veja [as modificações](newtab/MODIFICATIONS.md).

### Limpeza, Autoplay e Abas

Por padrão, apenas o histórico é selecionado para limpeza. A limpeza é tentada ao fechar a última janela; se interrompida, há recuperação na próxima abertura. O resultado só é registrado após as APIs terminarem com sucesso. **Limpar agora** funciona mesmo com a automação pausada.

Exceções protegem **somente cookies**, no domínio registrável e seus subdomínios. Elas não preservam cache nem localStorage e não garantem todos os logins. Importar domínios de favoritos é uma ação manual, sem alterar os favoritos. Arquivos baixados, senhas salvas e histórico da Conta Google não são apagados.

Autoplay inicia com padrão **Bloquear**, com regras por domínio/subdomínio. Interação real libera mídia naquele quadro até a próxima navegação. Permitir na extensão continua sujeito às restrições nativas do navegador; páginas internas e protegidas não aceitam os scripts.

A proteção da última aba mantém uma reserva criada pela extensão e preserva abas fixadas pelo usuário. Para encerrar e iniciar a limpeza, feche a janela pelo **X** ou saia do navegador. Não há garantia de a limpeza terminar antes do encerramento do processo.

## Permissões e dados

| Permissão | Uso |
| --- | --- |
| `browsingData` | Limpeza selecionada |
| `storage`, `alarms`, `notifications`, `background` | Preferências, agendamentos, recuperação, avisos e execução em segundo plano |
| `tabs`, `tabGroups`, `bookmarks` | Abas, site atual, indicador VPN, sincronização e importação manual de domínios |
| `unlimitedStorage`, `identity` | Cache e autenticação OAuth |
| `proxy`, `privacy`, `idle` | VPN, proteção WebRTC e recuperação da conexão |
| `scripting`, `webRequest`, `webRequestAuthProvider` e acesso HTTP/HTTPS | Integração da VPN, autenticação do proxy e scripts de controle de mídia |
| `history` — opcional | Contagem de visitas quando habilitada em conectores compatíveis |

Limpeza, autoplay e proteção de abas são locais. Sincronização, VPN e widgets online usam os serviços configurados. Os módulos preservam os espaços de armazenamento `superSync:`, `superVpn:` e `tabliss/config`, separados das preferências locais de limpeza/abas/autoplay. O núcleo Google Drive mantém tokens em memória e não os inclui nos backups, checkpoints ou logs de erro.

## Desenvolvimento e testes

Node.js 20 ou superior. Para instalar as dependências da suíte:

```sh
npm ci
npm run setup:vpn
npm run setup:newtab
npm run setup:sync
npm test
```

`setup:vpn` também fornece o PostCSS usado nos testes da base visual. Para editar e compilar a Sincronização, instale adicionalmente `npm run setup:sync`.

| Alteração | Comando |
| --- | --- |
| Templates estáticos e controles DOM do popup | `npm run build:ui` |
| Todas as interfaces, após instalar as três dependências de origem | `npm run build:interfaces` |
| Conferir artefatos estáticos | `npm run check:ui` |
| Interface da Sincronização | `npm run build:sync` |
| Worker com núcleo Google Drive próprio | `npm run build:sync-engine` |
| Somente interface da VPN | `npm run build:vpn-ui` |
| Motor Proton e interface VPN | `npm run build:vpn` |
| Estilos incorporados dos painéis | `npm run build:panels` |
| Catálogos globais | `npm run build:i18n` |
| Nova guia | `npm run setup:newtab` e `npm run build:newtab` |

`build:sync` recompila somente a interface; o worker próprio usa `build:sync-engine`. `build:vpn` preserva `vpn/source` e recompila o motor e a interface. Os dois módulos usam dependências da origem; consulte [a documentação da interface Sync](docs/sync-interface.md) e [da VPN](docs/vpn-interface.md) antes de alterar o processo.

A execução da **1.7.5 passou 214 testes**, incluindo contratos dos adaptadores e APIs simuladas. A interface foi conferida na rodada 1.6.8 no Helium com perfil temporário, sem contas pessoais; isso não comprova tráfego VPN nem sincronização com os serviços reais. O usuário confirmou a sincronização real com Google Drive na versão 1.6.2; os cenários avançados permanecem pendentes. [Cobertura e checklist manual](docs/validacao.md).

As fontes das páginas estáticas ficam em `ui/templates/`; `popup.html`, `spare-tab.html`, `newtab/index.html` e `ui.js` são gerados por `build:ui`. Consulte [os contratos e adaptadores](docs/ui-components.md) antes de alterar componentes. Incremente a versão conforme `AGENTS.md` ao entregar alterações instaláveis.

## Documentação

- [Guia rápido](LEIA-ME.md)
- [Próximos passos e critérios de conclusão](PROXIMOS-PASSOS.md)
- [Motor da VPN: contratos, primeira etapa e próximas substituições](docs/vpn-engine.md)
- [Novo motor de sincronização](docs/sync-engine.md)
- [Interface da Sincronização](docs/sync-interface.md)
- [Integração VPN](docs/proton-vpn.md) e [interface VPN](docs/vpn-interface.md)
- [Componentes e idioma compartilhados](docs/ui-components.md)
- [Validação e limitações](docs/validacao.md)

## Créditos

### Repositórios das extensões de origem

Origens registradas no projeto; a verificação histórica dos repositórios abaixo ocorreu em 9 de novembro de 2026. A referência Proton consta da documentação de integração:

| Extensão | Identificador na loja | Repositório público confirmado |
| --- | --- | --- |
| Auto Clear History on Exit (Kuuloa) | `hfdaikgklefacppkadgkncadaoehnlla` | Não foi encontrado um GitHub público confirmado. A análise e a adaptação usaram os arquivos da instalação local, versão 2.0.9. |
| AutoplayStopper (MV3) | `gcendpekmacfohmhhkbhejjfbepkkkib` | [kenijo/AutoplayStopperMV3](https://github.com/kenijo/AutoplayStopperMV3) |
| Don't Close Window With Last Tab | `dlnpfhfhmkiebpnlllpehlmklgdggbhn` | [moneytoo/DontCloseWindowWithLastTab](https://github.com/moneytoo/DontCloseWindowWithLastTab) |
| Tabliss | `hipekcciheckooncpjeljhnekcoolahp` | [joelshepherd/tabliss](https://github.com/joelshepherd/tabliss) — versão integrada: 2.6.0 |
| Floccus | `fnaicdffflnofjppbagibeoednhnbjhg` | [floccusaddon/floccus](https://github.com/floccusaddon/floccus) — versão integrada: 5.13.0 (MPL-2.0) |
| Proton VPN | — | [ProtonVPN/proton-vpn-browser-extension](https://github.com/ProtonVPN/proton-vpn-browser-extension) — fonte e licença GPL-3.0 preservadas |


A ausência de um repositório confirmado para a extensão de limpeza não significa que ele não exista; apenas não foi localizado na verificação acima.


O worker de limpeza e as traduções foram adaptados da [Auto Clear History on Exit 2.0.9](https://chromewebstore.google.com/detail/auto-clear-history-on-exi/hfdaikgklefacppkadgkncadaoehnlla), de Kuuloa.

As funções de autoplay e proteção da última aba foram reimplementadas após a análise de [AutoplayStopper (MV3)](https://chromewebstore.google.com/detail/autoplaystopper-mv3/gcendpekmacfohmhhkbhejjfbepkkkib) e [Don't Close Window With Last Tab](https://chromewebstore.google.com/detail/dont-close-window-with-last/dlnpfhfhmkiebpnlllpehlmklgdggbhn). Este projeto é independente e não é uma versão oficial dessas extensões.

A página Nova guia incorpora [Tabliss 2.6.0](https://github.com/joelshepherd/tabliss/tree/2.6.0), de Joël Shepherd e colaboradores, com licença GPL-3.0, avisos de dependências e código-fonte incluídos. As modificações da integração são identificadas em `newtab/MODIFICATIONS.md`; esta não é uma publicação oficial do Tabliss.
