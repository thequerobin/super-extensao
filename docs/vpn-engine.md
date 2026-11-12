# Motor da VPN — núcleo próprio, 1.7.13

Revisado em 12 de novembro de 2026. A Super Extensão controla as regras, as gravações do proxy, a máquina de estados, a restauração, a invalidação de operações, os despertares de recuperação e a persistência/renovação de tokens por módulos próprios em `vpn/engine`. O serviço continua sendo Proton. WebRTC e a coordenação do login foram extraídos na 1.7.12, completando as extrações funcionais previstas. A página oficial, os cabeçalhos/formatos/endpoints e utilitários de compatibilidade continuam em adaptadores. Isso não remove todo o código vendor nem substitui a revisão minuciosa em navegador.

## Responsabilidades ativas

| Parte | Implementação | Garantia / limite |
| --- | --- | --- |
| Regras e PAC | `vpn/engine/routing.js` | Mesmo avaliador para proxy e indicador; inclusão/exclusão, portas e redes locais |
| Controle do proxy | `vpn/engine/controller.ts` | Uma fila para aplicar/limpar; geração cancela aplicações antigas; confirma propriedade e configuração efetiva |
| API Chromium | `vpn/engine/chromium.ts` | `settings.get/set/clear` no escopo regular; lê `runtime.lastError` dentro do callback |
| Estado e ciclo das operações | `vpn/engine/state.ts` + `lifecycle.ts` | Intenção de conexão invalidada antes dos awaits; resultado antigo não reconecta nem desconecta uma tentativa nova |
| Recuperação | `vpn/engine/recovery.ts` + `vpn/initState.ts` | Listener síncrono, alarme `superVpn:recovery` a cada 30 s, verificações simultâneas agrupadas |
| Persistência/rotação | `vpn/engine/session.ts` + `account/sessionStore.ts` | Escritas ordenadas, refresh agrupado, comparação de sessão antes do commit, logout invalida respostas pendentes |
| Transporte HTTP | `vpn/engine/http.ts` + `httpClient.ts` adaptador | Deadline, abort, JSON/binário, erros, cooldown e auth retry próprios |
| Login | `vpn/engine/login.ts` + `account/loginFlow.ts` adaptador | Estado forte/temporário, consumo único durável e commit por geração próprios; página e troca do fork usam contrato Proton |
| Credenciais temporárias | `vpn/engine/credentials.ts` + `credential-data.ts` | Cache e pedidos agrupados por UID/geração, validade, renovação e cancelamento próprios; adaptador fornece o endpoint |
| Autenticação do proxy | `vpn/authHandler.ts` adaptado | Somente desafio de proxy do host e porta atuais; uma resposta por desafio; revalida estado após obter credenciais |
| WebRTC | `vpn/engine/webrtc.ts` + `chromium-privacy.ts` | Fila e política próprias, confirmação de propriedade/valor; leituras/escritas/clear regulares observam erros nativos |
| Catálogo e seleção | `vpn/engine/catalog.ts` + `selection.ts`, `vpn/serverCatalog.ts` como adaptador | Cache com identidade de conta, TTL, refresh agrupado, ranking estável e escolha manual/automática próprios; endpoints v1/v2 e decodificação de status preservados no adaptador |

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

O alarme é registrado a cada inicialização do worker e pode acordá-lo para verificar o estado. Eventos simultâneos compartilham uma verificação. O intervalo solicitado é de 30 s; versões do Chromium e condições de suspensão podem impor atraso ou intervalo maior. A segurança não deve depender de um despertar pontual. Não é garantia de execução pontual, conexão contínua ou de um bloqueio de rede absoluto. Catálogo e seleção usam políticas próprias desde a 1.7.11; localização, endpoints de catálogo e decodificação/cache binário de carga permanecem no adaptador Proton. Obtenção/cache/renovação de credenciais são coordenados pelo núcleo próprio desde a 1.7.9, com a chamada HTTP mantida no adaptador. As decisões de estado e a repetição das tentativas pertencem ao núcleo próprio. Reinício completo usa a preferência de conexão automática e a última escolha; é diferente da retomada de um worker suspenso.

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
2. Revisar contratos/adaptadores e utilitários restantes; manter a autorização do plano e a compatibilidade com o serviço.
3. Reavaliar persistência opcional e temporizadores auxiliares somente com testes de migração e evidência real.

## Indicador após trocar de servidor — 1.7.8

O leitor do host recebe a geração da conexão junto das regras e do estado confirmado. O cache de ícones por aba inclui essa geração, cor e idioma; mudanças do proxy também invalidam o cache. Assim, eventos intermediários de conexão agrupados não permitem considerar aplicado um ícone antigo depois de selecionar outro servidor. Somente o indicador por aba é alterado; o badge de pausa da limpeza permanece independente.

## Credenciais temporárias próprias — 1.7.9

`vpn/engine/credentials.ts` controla requisições, cache, expiração, renovação e falhas por portas de IO. `credential-data.ts` interpreta metadados de expiração/grupos/sessão e decide substituição de credenciais. Não importa módulos Proton nem APIs Chrome. Os arquivos em `account/credentials` mantêm os nomes públicos anteriores e adaptam a chamada autenticada a `vpn/v1/browser/token?Duration=...`, os desafios de autenticação e o armazenamento nativo.

- Pedidos simultâneos da mesma sessão/geração compartilham uma requisição. Troca de conta, logout ou cancelamento abortam o pedido e invalidam a resposta; mesmo um transporte que ignore o abort não consegue gravar/entregar uma resposta antiga. Eventos de troca de UID em outras páginas da extensão também invalidam o núcleo.
- A chave `superVpn:credentials` e os campos `credentials`, `sessionUid`, `time` e `halfLife` permanecem. `renewAt` é adicional e opcional; registros antigos válidos são reaproveitados. Caches sem UID, de outra sessão ou vencidos não são usados. Leituras/remoções antigas em storage.session continuam aceitas, mas as gravações ficam no mesmo armazenamento local existente.
- A validade usa o menor prazo entre o TTL da resposta nova e o `exp` dessa mesma credencial, corrigindo o uso acidental do token anterior. Os metadados são dicas conservadoras; não substituem a autorização do serviço. Tokens opacos continuam aceitos pelo TTL e podem ser substituídos por novas credenciais.
- A renovação começa em 90% da validade efetiva. O alarme de recuperação existente faz a manutenção quando há intenção ativa de conexão, inclusive depois de suspensão do worker. Consultas síncronas usam somente cache válido em memória e podem solicitar renovação sem bloquear o pedido atual. Não há mais um temporizador de longa duração do Proton para essa política.
- Cada chamada ao endpoint de credenciais tem prazo limite de 20 s. Falhas transitórias e limitação de requisições usam espera progressiva de 1 s até 60 s entre tentativas, sem bloquear o worker com sleeps. O transporte existente continua respeitando Retry-After. Uma credencial anterior ainda válida pode continuar em uso; após vencer, deixa de ser fornecida, e a falha transitória solicita recuperação da conexão.
- Um erro de token de acesso pode renovar a sessão e repetir o pedido uma única vez, sem zerar uma sessão válida. Logout exigido pelo serviço e recusas definitivas preservam o tratamento de autorização existente. Respostas incompletas ou inválidas são recusadas antes de qualquer gravação.
- Escritas e remoções são ordenadas; uma gravação atrasada não restaura credenciais após logout. O código de remoção usado pelo popup não importa o cliente do worker. A invalidação não espera uma leitura de sessão dentro da fila de armazenamento, evitando dependência circular durante logout.

Os 27 testes de `tests/vpn-credentials.test.cjs` cobrem concorrência, cache legado, expiração do token novo, renovação após suspensão, falhas/limites/prazo máximo, troca de conta, callbacks atrasados, descarte durante escrita e renovação de sessão, falhas nativas de armazenamento e integração do adaptador com recuperação. São transportes e dados fictícios; nenhum segredo real foi colocado nos testes ou logs.

## Transporte HTTP próprio — 1.7.10

`vpn/engine/http.ts` controla execução, leitura e falhas HTTP sem importar código Proton ou APIs Chrome. `httpClient.ts` fornece fetch nativo, sessão, cabeçalhos e o armazenamento de cooldown; `api.ts` mantém os nomes públicos, os tipos/checagens do protocolo, o bloqueio de atualização obrigatória e as regras de exclusão/inclusão da API no proxy.

- Prazo padrão de 20 s para preparar sessão/cabeçalhos, enviar, ler o corpo e concluir eventual repetição. O sinal do chamador cancela a operação sem cancelar o refresh compartilhado de outros chamadores. Streams parados são cancelados, e transportes que ignorem abort não podem entregar respostas atrasadas.
- Cabeçalhos do chamador são copiados. Após refresh, a repetição usa Authorization novo; não reutiliza cabeçalhos modificados pela tentativa anterior. A sessão e sua geração são conferidas antes/depois dos awaits. Troca de UID por outra página da extensão também invalida resultados. O logout remoto explícito pode continuar usando somente o snapshot da sessão que acabou de ser removida localmente.
- Uma única renovação/repetição automática para GET/HEAD com erro HTTP 401 e Code 401. POST e outras mutações, rotas de autenticação, cabeçalhos de autenticação manuais e chamadas raw não são repetidos automaticamente. Falhas de rede também não são repetidas pelo transporte. O marcador `authRetried` impede uma segunda renovação nos adaptadores de conta/credenciais, inclusive quando o próprio refresh falhar. Requisições concorrentes usam o SessionStore próprio para compartilhar refresh.
- HTTP 429 e 503 respeitam Retry-After em segundos ou data HTTP, com fallback de 10 s e limite de sete dias. Não há sleep longo: novas chamadas no intervalo recebem erro imediatamente sem atingir a rede. A chave combina sessão UID, método, origem e rota; os templates removem parâmetros de lookup e o seletor de fork. Queries, tokens, cabeçalhos e corpos não são persistidos. Apenas prazo/status ficam em `superVpn:httpCooldown:*`, preferencialmente em storage.session, permitindo respeitar o limite após suspensão do worker.
- JSON, dados binários (inclusive Content-Type com parâmetros), 204 e 304 mantêm contratos de leitura e builders. Erros preservam status HTTP, Code, mensagem do serviço e Details. Texto inesperado e falhas de fetch não expõem o corpo, a URL ou os tokens na mensagem. A detecção de software bloqueador usa o conteúdo apenas em memória, sem registrar HTML bruto.
- O cliente aceita somente HTTPS na origem configurada da API e usa redirect:error. Não encaminha automaticamente autorização para outra origem. Erros novos são normalizados antes de chegar aos chamadores; o bloqueio de atualização Code 5003 continua na fachada de compatibilidade.

Os 29 contratos de `tests/vpn-http.test.cjs` cobrem o núcleo e os adaptadores reais com transporte/armazenamento simulados. Incluem retry seguro e limitado, refresh concorrente, cancelamento isolado, resultados de conta antiga, cooldown entre instâncias, erros 429/503, binário, 304, upgrade, bloqueador HTML e restrições de origem. O contrato adicional de credenciais cobre o orçamento de auth já consumido pelo transporte.

## Catálogo e seleção próprios — 1.7.11

`vpn/engine/catalog.ts` coordena cache durável, validade, atualização bloqueante ou em segundo plano e agrupamento de requisições concorrentes. Usa as chaves existentes; o campo `owner` identifica UID, plano e grupos, sem copiar tokens. Caches antigos sem identificação são refeitos. Contas diferentes, logout, descarte e alteração do plano invalidam respostas em andamento. Escritas e remoções passam por uma fila; lookups são inseridos por ID com uma guarda capturada antes da rede, sem duplicar registros ou rejuvenescer todo o catálogo.

As respostas 304 preservam `Last-Modified` textual, `StatusID` e o horário da carga. Falhas transitórias podem reutilizar dados até o TTL bloqueante mais 24 horas; esse fallback não renova o horário. Erros de autenticação/upgrade não usam esse fallback. A atualização da carga aguarda persistência e grava `lastLoadUpdate` no objeto salvo; sua validade usa a diferença entre relógio e timestamp. Os adaptadores preservam endpoints v1/v2, IncludeID, cabeçalhos e status binários. A API do serviço continua autorizando a conta e o plano.

`vpn/engine/selection.ts` implementa ranking por distância/capacidade/país, ordenação natural, filtro por escolha, sorteio de candidatos elegíveis, escolha de endpoint e alternativas. O ranking remove a variação aleatória e desempata por ID. Escolhas automáticas exigem saúde, tier e `AutoConnectable`. A recuperação de um ID manual dispensa `AutoConnectable`, mas mantém saúde e tier, e nunca substitui silenciosamente esse ID. Probes de uma escolha manual não fazem rotação; falhas/reinícios continuam restaurando o proxy salvo conforme a máquina de estados. Se o servidor manual estiver em manutenção, o usuário escolhe outro. Reabrir um recente manual preserva essa intenção, sem convertê-lo para modo mais rápido.

A seleção física prioriza endpoints ativos, pode tentar status desconhecido no adaptador compatível e não recorre a endpoints confirmadamente indisponíveis. O failover automático conserva o tier e Secure Core, prioriza o mesmo país/recursos e só relaxa o país se necessário. A consulta de saúde e as guardas de geração existentes continuam impedindo trocas por metadados incompletos ou respostas atrasadas.

`tests/vpn-catalog.test.cjs` cobre 28 contratos do núcleo, endpoints v1/v2 e adaptadores reais de estado com APIs simuladas; o teste da interface também cobre recente manual. Não foram medidos latência, IP ou tráfego real nesta rodada.

## WebRTC e coordenação do login — 1.7.12

`vpn/engine/webrtc.ts` contém a política e a fila de proteção/restauração; `chromium-privacy.ts` encapsula `privacy.network.webRTCIPHandlingPolicy` em escopo regular. Aplicar proteção exige que a preferência possa ser controlada e, após a escrita, que o navegador reporte `controlled_by_this_extension` com o valor esperado. Um valor padrão igual, sem propriedade, não é tomado como sucesso. Limpar retira só a preferência da extensão, verifica que ela não continua no controle e não escreve o valor de outra extensão. Erros de callback são consumidos dentro do callback; falhas não inutilizam a fila. Sem API, o núcleo retorna indisponibilidade e a camada de proteção obrigatória recusa prosseguir.

As páginas enviam pedidos ao worker. Ele revalida intenção de conexão e preferência, impedindo que um painel desatualizado limpe a proteção de uma conexão ativa. O controlador do proxy continua aplicando proteção antes do proxy e retirando-a depois da limpeza confirmada. A fila nativa não é liberada por timeout enquanto um callback de escrita ainda puder chegar. Isso não mede vazamento real de IP/WebRTC; requer validação com tráfego.

`vpn/engine/login.ts` implementa `LoginFlow`, independente de DOM/Chromium. `account/loginFlow.ts` fornece armazenamento nativo, 32 bytes aleatórios, URL de autorização, endpoint de troca e commit no SessionStore próprio. O worker recebe `beginLogin` somente de páginas internas. A página oficial permanece responsável por senha/MFA; o núcleo recebe apenas o fork e nunca recebe a senha da conta.

`superVpn:loginFlow` contém um estado aleatório de 43 caracteres, datas de criação/expiração e metadados de parceiro, sem tokens/selector. Validade de 15 minutos, origens HTTPS exatas e validação de payload são próprias. Uma nova tentativa substitui a anterior. Antes da troca HTTP, o worker persiste uma marca de consumo; callbacks duplicados e reinício após o consumo não repetem a troca. Uma falha exige iniciar novamente pelo botão Entrar. Logout invalida imediatamente a geração e enfileira a remoção durável. Commit de sessão valida geração e expiração, mantendo `persistent` e parceiro como metadados. Respostas ao site contêm somente a confirmação pública; erros de troca não expõem conteúdo de resposta ou credenciais.

O adaptador mantém `app`, `appVersion`, `t`, `plan`, `partnerId` e `independent` exigidos pela página Proton e codifica o selector no endpoint. O relay e mensagens externas aceitam apenas as origens oficiais; mensagens de conta não podem iniciar login nem alterar WebRTC. A aba oficial usa prazo de relay de 30 segundos, compatível com o limite HTTP de 20 segundos. Falhas ao abrir a aba agora são aguardadas e propagadas. Estados `f...` de versões anteriores não são reutilizados: uma aba de autorização já aberta precisa ser iniciada novamente pela extensão.

A extração funcional está implementada; permanecem adapters/formatos do serviço, mensagens e utilitários legados. O serviço, infraestrutura e autorização do plano continuam sendo Proton, e as fontes/licenças mantêm-se no repositório. Não se declara remoção de todas as dependências vendor. A revisão minuciosa solicitada pelo usuário permanece pendente.

`tests/vpn-login-privacy.test.cjs` adiciona 22 testes do núcleo e dos adaptadores reais com APIs simuladas, incluindo duplicatas, suspensão, logout durante troca, expiração, erros nativos, propriedade da preferência e pedidos de UI antigos. As verificações de origem existentes também cobrem as novas ações internas.

## Revisão de privacidade — 1.7.13

A [auditoria](auditoria-vpn.md) registra achados, mudanças, evidências e limites. `network-guard.ts` mantém bloqueio declarativo dinâmico com liberação apenas em regra de sessão e preserva regras alheias. O estado nativo bloqueia antes das credenciais, não encerra silenciosamente a intenção em falhas e só libera após proxy confirmado/probe HTTPS sem credenciais. A limpeza do proxy arma o bloqueio antes de retirar configurações. Logout preserva bloqueio; desconectar explicitamente pode liberá-lo.

PAC obrigatório, CIDR sem DNS, remoção do envio HTTP legado de credenciais, previsão de rede desativada, bloqueio de WebTransport, avisos de privacidade independentes de preferências e indicador vermelho compõem as correções. O campo `blocked` é intenção/estado de segurança, não prova de pacotes. Apenas readback confirma regras/configurações; tampouco isso prova ausência de vazamentos ou encerra sockets existentes. O teste Chromium real foi impedido por restrição de sockets; aprovação exige o roteiro de captura e falhas da auditoria.


## Prazos de IO — 1.7.14

O núcleo `vpn/engine/io.ts` limita a espera de quem chama; não cancela uma operação nativa já enviada. O adaptador compartilhado cobre sessão, estado de login, credenciais, cache/configuração e cooldown HTTP sem alterar chaves nem copiar tokens.

| Operação | Prazo por chamada |
| --- | --- |
| Leitura de armazenamento | 5 s |
| Política gerenciada | 1,5 s |
| Gravação/remoção de armazenamento | 8 s |
| Estado/idioma via worker | 5 s |
| Conta via worker | 30 s |
| Comando via worker | 15 s |
| Consumo do fork de login | 40 s (ponte da página: 45 s) |

Sequências de várias chamadas podem levar mais tempo. O carregamento da configuração empacotada também tem prazo de 5 s. Ausência explícita do esquema gerenciado permite a configuração empacotada; falha/timeout do serviço não equivale a ausência de política.

Leituras vencidas são descartadas e podem ser repetidas. Gravações são ordenadas por área nativa dentro de cada contexto ativo: um timeout rejeita a promessa observada, mas a fila só avança depois da conclusão real da API. Remoções pendentes, inclusive logout, continuam enfileiradas. A fila não é um mecanismo transacional entre processos nem persiste após encerramento do contexto. APIs que nunca confirmam uma escrita mantêm a fila retida; não existe cancelamento nativo seguro que permita liberar essa fila.

O logout invalida a geração imediatamente e tenta remover sessão e credenciais mesmo se a leitura anterior falhar. Não há fallback para memória/localStorage apresentando falha como persistência bem-sucedida. Falhas de armazenamento observadas pelo worker acionam a proteção de rede da intenção ativa. O prazo de uma mensagem não desarma o bloqueio nem cancela uma desconexão já em execução.

Mensagens de leitura pendentes são invalidadas ao enviar um comando. Comandos de mesmo tipo não são reenviados nesse canal enquanto a resposta real estiver pendente, inclusive após timeout; outras ações, como desconectar, continuam disponíveis e usam as gerações do motor. Essa deduplicação vale por contexto ativo, não entre painéis/reinícios. O painel não apresenta uma confirmação de conexão antiga após erro de IO: mostra **Estado não confirmado**, oculta o IP anterior e permite **Tentar novamente** para consultar. Respostas antigas de carregamento não restauram uma conta após logout ou mudança de estado.

Os prazos não liberam filas de proxy, DNR ou privacidade. A verificação real de reinício, falhas nativas e vazamento IP/DNS continua pendente; os testes simulados desta etapa não comprovam ausência de vazamentos.
