# Motor da VPN — estado e recuperação próprios, 1.7.4

Revisado em 12 de novembro de 2026. A Super Extensão controla as regras, as gravações do proxy, a máquina de estados, a restauração, a invalidação de operações, os despertares de recuperação e a persistência/renovação de tokens por módulos próprios em `vpn/engine`. O serviço continua sendo Proton; o protocolo de login, as chamadas HTTP, a obtenção de credenciais temporárias, a seleção/rotação de servidores e a proteção WebRTC ainda usam adaptadores do código Proton. Esta entrega não conclui a independência de todo o motor.

## Responsabilidades ativas

| Parte | Implementação | Garantia / limite |
| --- | --- | --- |
| Regras e PAC | `vpn/engine/routing.js` | Mesmo avaliador para proxy e indicador; inclusão/exclusão, portas e redes locais |
| Controle do proxy | `vpn/engine/controller.ts` | Uma fila para aplicar/limpar; geração cancela aplicações antigas; confirma propriedade e configuração efetiva |
| API Chromium | `vpn/engine/chromium.ts` | `settings.get/set/clear` no escopo regular; lê `runtime.lastError` dentro do callback |
| Estado e ciclo das operações | `vpn/engine/state.ts` + `lifecycle.ts` | Intenção de conexão invalidada antes dos awaits; resultado antigo não reconecta nem desconecta uma tentativa nova |
| Recuperação | `vpn/engine/recovery.ts` + `vpn/initState.ts` | Listener síncrono, alarme `superVpn:recovery` a cada 30 s, verificações simultâneas agrupadas |
| Persistência/rotação | `vpn/engine/session.ts` + `account/sessionStore.ts` | Escritas ordenadas, refresh agrupado, comparação de sessão antes do commit, logout invalida respostas pendentes |
| Login e transporte Proton | `account/fork/*`, `messaging/forkSession.ts`, `api.ts` | Página oficial e formato do serviço preservados; fork atrasado não salva depois do logout |
| Credenciais temporárias | `account/credentials/*` adaptado | Resposta de geração/conta anterior é descartada; cache validado por UID |
| Autenticação do proxy | `vpn/authHandler.ts` adaptado | Somente desafio de proxy do host e porta atuais; uma resposta por desafio; revalida estado após obter credenciais |
| WebRTC | Adaptadores `webrtc/*` | Proteção antes do proxy; restauração depois da limpeza; erros da API são observados |
| Protocolo e seleção | `state.ts` como fachada, `getLogicals.ts`, `pickServerInLogical.ts` | Autenticação, seleção/rotação e preferências de auto-conexão fornecidas ao núcleo por portas |

Os caminhos que não começam com `vpn/engine` são relativos a `vendor/proton-source/source/js/`. A interface própria permanece em `vpn/source`.

## Ordem das operações

Uma aplicação valida o endpoint, consulta a propriedade do proxy, instala o interceptor de autenticação, aplica a preferência WebRTC e grava o proxy. Depois lê novamente a configuração, exige `controlled_by_this_extension`, compara o endpoint/listas ou o PAC e atualiza o cache de autenticação. Somente então a conexão pode ser marcada como confirmada e emitir a notificação de sucesso.

Conectar, trocar regras e desconectar compartilham a mesma fila. Uma desconexão invalida imediatamente operações antigas; se um `settings.set` já estiver em andamento, sua conclusão é aguardada e sua configuração é retirada antes de prosseguir. A fila aguarda callbacks de escrita/limpeza para impedir que uma gravação atrasada reapareça depois da desconexão. Não há timeout que libere a fila enquanto um callback de escrita ainda possa chegar.

Em falhas após preparar a conexão, o controlador tenta retirar apenas a configuração desta extensão. Ele não instala uma configuração global `direct`/`system` nem altera o proxy de outra extensão. O interceptor e a proteção WebRTC são liberados depois da confirmação de que o proxy próprio foi removido. Se a limpeza falhar, a falha é reportada e uma nova desconexão pode tentar novamente.

O endpoint é validado no modo fixo e na geração do PAC. Exclusões usam `fixed_servers`; inclusão usa `pac_script`. O modo fixo não envia a propriedade interna `includeOnly` à API. O indicador e os eventos de estado distinguem intenção de conexão de proxy confirmado; o indicador continua descrevendo política, sem medir pacotes ou certificar externamente o IP.

## Sessão e compatibilidade

| Dados | Chave / área | Compatibilidade |
| --- | --- | --- |
| Sessão e metadados do fork | `superVpn:session`, local | Mesma chave e formato existentes, sem migração de tokens |
| Credenciais temporárias | `superVpn:credentials`, local | Cache identificado pelo UID; caches antigos sem UID são renovados |
| Servidor em andamento | `superVpn:connectedServer`, session | Escritas ordenadas; sobrevive à suspensão do worker, não ao reinício completo do navegador |
| Escolha/histórico | `superVpn:last-choice`, `superVpn:last-choices`, local | Preferências existentes preservadas |
| Regras e recursos | `superVpn:split-tunneling`, `superVpn:auto-connect` e demais chaves locais | IDs e valores preservados |

O logout invalida imediatamente a geração da sessão e enfileira sua remoção. Uma troca de conta posterior não pode ser apagada por uma limpeza antiga; uma renovação ou fork antigos não podem restaurar a sessão encerrada. O refresh mantém UID, flags de persistência e metadados do fork. O adaptador continua usando a API oficial `auth/refresh`, sem colocar tokens nos logs ou na interface.

A preferência `persistent` é preservada como metadado; o armazenamento já era local na versão anterior e continua assim. Esta entrega não redefine a semântica desse recurso nem transfere dados para outros módulos.

## Inicialização e recuperação

Com um servidor na sessão, a inicialização pode instalar o endereço de espera `localhost:9` antes de recuperar a conexão. O trabalho de inicialização também possui guarda de geração. A restauração do estado acontece uma vez; foi removida a segunda recuperação baseada em um servidor salvo que poderia sobrepor uma desconexão durante o início.

O alarme é registrado a cada inicialização do worker e pode acordá-lo para verificar o estado. Eventos simultâneos compartilham uma verificação. O intervalo de 30 s respeita o mínimo do Chromium 116 declarado no manifest. Não é garantia de execução pontual, conexão contínua ou de um bloqueio de rede absoluto. A obtenção/renovação de credenciais temporárias, a seleção/rotação de servidor e a atualização de caches de localização/carga ainda usam adaptadores Proton. As decisões de estado e a repetição das tentativas pertencem ao núcleo próprio. Reinício completo usa a preferência de conexão automática e a última escolha; é diferente da retomada de um worker suspenso.

## Máquina de estados própria — 1.7.4

`vpn/engine/state.ts` implementa `ConnectionMachine` sem importar tipos, módulos ou globais Proton/Chromium. As portas fornecem IO e protocolo; o adaptador `vendor/proton-source/source/js/state.ts` mantém os comandos e as mensagens existentes, os desafios de autenticação e a seleção de servidores.

- Conexão, desconexão, logout e alteração de regras invalidam operações anteriores antes de novos awaits. Cada transição cria uma identidade de estado; callbacks antigos não conseguem alterar uma conexão nova.
- A restauração lê o servidor da sessão uma única vez e respeita comandos executados durante a leitura. A barreira de prontidão resolve após decidir o estado inicial, sem aguardar credenciais ou metadados remotos. O resumo público continua exigindo confirmação do proxy para mostrar conexão ativa.
- A recuperação agrupa execuções por geração. Reaplica um proxy perdido, valida credenciais e só anuncia conexão após confirmação pelo controlador. Falhas transitórias de rede mantêm servidor/intenção e mostram aviso; o próximo alarme tenta novamente. Falhas de permissão/configuração encerram a tentativa.
- Erros do proxy solicitam uma nova aplicação com intervalo mínimo de 20 s; tentativas adiadas ficam para o próximo alarme de 30 s. A política de retry não depende mais do `setTimeout` legado de `retryCredentials.ts`.
- Atividade e verificações periódicas de saúde são coordenadas nos despertares. A consulta de saúde/seleção continua no adaptador, com uma guarda revalidada após cada await antes de trocar de servidor. Falhas de metadados não derrubam uma conexão confirmada.
- A gravação do servidor é ordenada. Limpeza de proxy que falhar após desconexão/logout é repetida nos próximos despertares, sem reconectar. Ativar o computador apenas solicita recuperação do estado atual, sem reconstruir uma intenção a partir de servidor antigo.

As chaves de sessão, credenciais, último servidor e preferências permanecem iguais; não há migração ou novo login obrigatório. Não há garantia de temporização exata de alarmes nem de túnel ativo baseada somente no estado salvo.

## Estabilidade do servidor — 1.7.5

A 1.7.4 reiniciava `lastProbe` como imediatamente vencido em cada transição. Uma seleção automática podia causar nova verificação assim que o próximo servidor conectasse. Agora conectar, restaurar ou reconfigurar dá ao servidor um intervalo completo antes de consultar novamente sua saúde; perda de proxy e recuperação de credenciais continuam sendo verificadas nos despertares.

`vpn/engine/health.ts` classifica os dados como disponível, indisponível ou desconhecido. Visibilidade na lista, ausência de campos, ausência do servidor na resposta e o `_up` calculado anteriormente não provam indisponibilidade. O adaptador combina a resposta v2 com os status indicados por `StatusID` antes de decidir, encontra o ID solicitado independentemente de representação numérica/textual e só solicita alternativa com evidência explícita de indisponibilidade. Uma falha nessa consulta mantém o servidor e é tratada como falha de metadados; não inicia uma troca.

## Reconstrução e testes

```sh
npm ci
npm run setup:vpn
npm run setup:newtab
npm run setup:sync
npm run build:vpn
npm test
npm run check:ui
node vendor/proton-source/node_modules/typescript/bin/tsc --noEmit -p vendor/proton-source/tsconfig.json
node vendor/proton-source/node_modules/typescript/bin/tsc --noEmit -p vpn/tsconfig.interface.json
```

Os bundles compilados ficam versionados em `vpn/js`. A compilação preserva `vpn/engine`, a interface e os avisos GPL em `vendor/proton-source` e `vpn/LICENSE`.

Os testes de `tests/vpn-controller.test.cjs` exercitam fila e rollback, tomada por outra extensão, callbacks de erro, troca rápida, desconexão com escrita em andamento, credenciais tardias, estado real do adaptador, notificações após confirmação, desafios de autenticação e sessão/fork depois do logout. `tests/vpn-state.test.cjs` cobre restauração, prontidão sem bloqueio de rede, falhas e retomada, disputas de credenciais/regras/servidores, limpeza repetida após falha, throttling de retries e persistência ordenada. As demais suítes continuam cobrindo PAC minificado, permissões, autorização de plano, interface e indicador. São testes com APIs/transportes simulados; login real, IP, tráfego, WebRTC e recuperação nativa seguem pendentes em [validacao.md](validacao.md).

## Trabalho restante

1. Validar os novos fluxos com conta de teste no Chromium/Helium: login, IP, regras, erro de rede, logout durante conexão e retomada do worker.
2. Extrair a obtenção/cache/renovação das credenciais temporárias do adaptador, preservando os contratos de sessão e geração.
3. Migrar transporte, cache e seleção de servidores; manter a autorização do plano e a compatibilidade com o serviço.
4. Reavaliar persistência opcional e temporizadores auxiliares somente com testes de migração e evidência real.
