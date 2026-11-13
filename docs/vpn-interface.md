# Interface própria da VPN — referência 1.6.8

## Componentização 1.6.8

As funções de tela em `vpn/source/app.js` compõem botões, campos, cartões, toggles e ações pelo mesmo catálogo das demais telas. `ui/render.cjs` transforma os templates `ui-*` em HTML nativo na fronteira de renderização. Os eventos delegados, atributos `data-*`, foco, rascunhos e estado da interface foram preservados. Valores externos continuam escapados antes da interpolação; o renderizador de componentes não sanitiza HTML arbitrário.

O adaptador não consulta a rede e não modifica `bridge.ts`, autorização de plano, controlador de proxy ou regras de tunelamento. [Contratos e compilação](ui-components.md).

A aba VPN usa `vpn/source`, sem montar o HTML, JavaScript ou CSS do popup original. A compilação das regras/PAC já usa o núcleo próprio de `vpn/engine`; autenticação, servidores, autorização de plano, aplicação do proxy e estado continuam no adaptador Proton. O worker Proton permanece ativo, com uma ponte para o indicador próprio do host. A primeira substituição e os contratos restantes estão em [vpn-engine.md](vpn-engine.md).

## Telas

- **Conexão:** estado confirmado pelo worker, conexão automática ao país mais rápido, servidor aleatório, desconexão/cancelamento, lista de servidores gratuitos e conexões recentes quando ativadas.
- **Servidores:** pesquisa por país, cidade ou nome; filtros Meu plano, Gratuitos, Todos e Secure Core; ocupação e manutenção. Contas Free continuam limitadas aos servidores gratuitos. Os servidores ficam agrupados por país, inicialmente recolhidos, com bandeiras SVG locais e contagem por grupo. Cada grupo carrega mais 50 servidores por vez. As barras de rolagem ficam ocultas, preservando a rolagem.
- **Recursos:** conexão ao iniciar, proteção WebRTC, notificações, Secure Core e memória de conexões recentes. Disponibilidade e controle por dispositivo são respeitados. Regras de tunelamento dividido têm listas separadas de inclusão/exclusão e suporte a subdomínios. Alterações ficam em rascunho até salvar; regras são aplicadas à conexão ativa.
- **Conta:** identificação do plano, idioma compartilhado, links oficiais e saída da conta com confirmação.

O login abre a página oficial Proton pelo fluxo de autorização existente, com estado aleatório e validação no worker. A interface não coleta a senha. A conexão só aparece como concluída após confirmação do motor; o IP mostrado é o IP de saída informado para o servidor, não uma medição independente do tráfego.

## Código e compilação

`vpn/source/bridge.ts` concentra o acesso ao motor. O app só recebe uma projeção dos dados de conta e conexão: tokens, senha VPN e credenciais do proxy não são entregues à camada visual. Mensagens continuam no canal `super-vpn`, e a persistência mantém o prefixo `superVpn:`. Os IDs e formatos de sessões e regras existentes são preservados. O estado de navegação novo usa `superVpn:interface-view`, com migração das páginas estáveis de `superVpn:view-state`.

Para recompilar somente a interface:

```sh
npm ci
npm run setup:vpn
npm run build:vpn-ui
npm test
```

Para reconstruir também o motor, use `npm run build:vpn`. Esse comando preserva `vpn/source`, recompila o worker e os recursos originais, recompila a interface própria e atualiza os estilos compartilhados. `npm run build:sync` continua reconstruindo somente a interface da sincronização e os estilos dos painéis.

A entrada integrada é `vpn/interface.js`; `vpn/interface.html` oferece a mesma interface em página independente. A licença GPL-3.0 e o código-fonte Proton continuam em `vpn/LICENSE`, `vendor/proton-source` e nos avisos de integração.

## Validação

Testes DOM cobrem o posicionamento da automação de limpeza antes do relatório, espaçamento consistente do cabeçalho, login, busca, filtros de plano/manutenção, confirmação do estado conectado, saída com confirmação, regras de inclusão/exclusão, idioma e proteção contra injeção de HTML. Testes do adaptador verificam comandos reais esperados pelo motor, proteção de credenciais, limites de plano, isolamento de canais, WebRTC e atualização das regras em uma conexão ativa. O bundle de produção também é carregado com um perfil simulado vazio. A ponte TypeScript é verificada com `tsc --noEmit -p vpn/tsconfig.interface.json` usando as dependências do motor.

Na rodada 1.6.8, o painel sem login foi aberto no Helium com perfil temporário, sem erros de página nem estouro horizontal no estado medido. Testes DOM continuam cobrindo os demais estados com APIs simuladas. Login real, mudança de IP, tráfego por domínio e recuperação da conexão continuam pendentes. [Evidências e limites](validacao.md).

O carregamento é progressivo: sessão, estado do worker, preferências e histórico aparecem primeiro; a conta/plano são consultados em seguida, e a lista de servidores e o contexto de rede chegam por último. A busca de servidores não bloqueia os menus, os recursos já autorizados nem a desconexão. Ações de conexão aguardam os servidores; falhas da busca ficam na seção de servidores, com opção de tentar novamente.

## Indicador no ícone

O host carrega `vpn-indicator.js` antes do motor e recebe um leitor sem credenciais, limitado ao estado confirmado e às regras efetivas de `getFixedServerConfig`. Um símbolo verde com visto indica que o endereço da aba usa a VPN; um símbolo azul com traço indica VPN conectada e endereço fora do túnel. Sem conexão confirmada, o ícone original volta. O símbolo fica no canto superior direito e preserva o badge de limpeza pausada.

A indicação acompanha navegação, troca de aba, alterações das regras e idioma. Respeita inclusão/exclusão, subdomínios, redes locais e o controle efetivo do proxy pelo navegador, incluindo abas anônimas. Representa o roteamento do endereço da aba, não um contador de tráfego nem uma verificação externa do IP.

## Trabalho restante

Login real, roteamento por domínio, cores do indicador, modo anônimo, recuperação e geometria do popup continuam no [checklist de validação](validacao.md). Regras, controlador de proxy, gerações, alarmes e persistência/renovação de tokens são próprios na 1.7.0. As próximas extrações são o restante da máquina de estados, credenciais e transporte. O roteiro está em [PROXIMOS-PASSOS.md](../PROXIMOS-PASSOS.md).

Tema e foco usam a [base compartilhada](ui-components.md), revisada em 1.6.3. Confira o [registro de validação](validacao.md) para distinguir testes DOM, relatos do usuário e cenários ainda pendentes.

### Correção do indicador 1.7.1

A navegação e a recarga invalidam o cache de action da aba, permitindo reaplicar azul/verde mesmo quando a política de roteamento permanece igual. Ativação e substituição da aba também forçam a atualização. Sem controle confirmado do proxy, o ícone fica normal. A alteração não muda quais sites usam a VPN nem modifica o badge da limpeza.

### Abertura com estado real 1.7.2

O shell pré-consulta `connectionState`, ouvindo eventos enquanto carrega os scripts. O painel selecionado pode iniciar antes da barreira de primeiro frame; `SuperVpnReady` sinaliza que preferências de navegação e o estado leve já foram lidos. A primeira renderização da seção usa o resumo confirmado do worker, sem tratar servidor salvo como “conectando” e sem esperar conta/plano ou servidores. A aba Conexão mantém o cartão estável enquanto as consultas secundárias terminam; carregamento/erro da lista fica na seção Servidores quando já há conexão ativa.

O bootstrap existe apenas na memória deste popup, sem cache persistente de conexão. A consulta usa estado atual e propriedade/configuração efetiva do proxy; eventos mais recentes têm prioridade sobre respostas pendentes. Sem confirmação, a interface mantém um estado neutro, desconectado ou conectando conforme a situação real. Desconectar permanece disponível durante o carregamento dos servidores. A reabertura não envia comandos de conexão.


### Importar domínios dos favoritos (1.7.27)

Em VPN → Recursos, escolha o modo de tunelamento dividido (exclusão ou inclusão) e use **Escolher / atualizar pasta de favoritos**. O acesso opcional aos favoritos é solicitado no clique. Selecione a pasta, escolha se inclui subpastas e revise a prévia de novos domínios, itens já presentes e links ignorados. **Importar domínios dos favoritos** preenche o rascunho; **Salvar** aplica a configuração pelo mesmo fluxo usado na edição manual. A importação não ativa o tunelamento dividido nem altera o modo escolhido.

A limpeza e a VPN compartilham a travessia de pastas e a coleta de domínios em `rules.js`. O adaptador da VPN usa apenas o hostname, ignorando caminho, consulta, fragmento e porta. HTTP/HTTPS são aceitos; outros esquemas e URLs com credenciais são ignorados. Duplicados são comparados no modo selecionado; regras existentes e suas opções de subdomínios são preservadas. Novos itens usam a opção de subdomínios do formulário. Pastas e URLs não são gravadas na configuração da VPN: somente as regras de domínio salvas.

A importação é uma cópia, sem acompanhamento de mudanças futuras nos favoritos e sem modificar os favoritos ou as listas da limpeza. No modo exclusão, os domínios importados passam a navegar fora da VPN quando o tunelamento dividido estiver ativo. No modo inclusão, somente os domínios incluídos usam a VPN. Políticas gerenciadas que impedem editar as regras também impedem a importação.

Validação desta alteração: 468 testes aprovados, compilação da interface de produção, verificação TypeScript da interface e checagem dos componentes compartilhados. O acesso aos favoritos foi exercitado com APIs simuladas; não houve teste manual no perfil pessoal do navegador.


### Carregamento dos recursos e restrições (1.7.28)

A interface distingue carregamento da conta/recursos de restrições do dispositivo. Antes da resposta da conta, as opções continuam desativadas, mas indicam que aguardam o carregamento; uma consulta que falhou aparece também em Recursos, com o motivo e botão de tentar novamente. A mensagem de controle pelo dispositivo fica reservada às configurações não editáveis após concluir essa etapa. A correção não remove políticas gerenciadas nem habilita controles antes de obter os dados necessários. Uma falha posterior no catálogo de servidores não volta a bloquear recursos já carregados.

Validação: 470 testes aprovados, incluindo falha de carregamento, recuperação após tentar novamente e preservação de restrições reais; compilação de produção, TypeScript e checagem de componentes aprovados. A causa da falha no perfil do usuário não foi observada diretamente.
