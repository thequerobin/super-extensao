# Motor próprio da VPN — primeira etapa, 1.6.5

O motor próprio foi iniciado pela **compilação das regras de roteamento**. `vpn/engine/routing.js` produz a configuração de proxy e o PAC usados no Chromium; o indicador usa o mesmo avaliador de destinos. Sessão, autenticação, servidores, credenciais, escrita nas APIs do navegador e recuperação continuam no adaptador Proton. O serviço de VPN continua sendo o Proton.

## Responsabilidades atuais

| Responsabilidade | Implementação ativa | Contrato para a migração |
| --- | --- | --- |
| Interface e comandos | `vpn/source/app.js`, `vpn/source/bridge.ts` | Receber somente dados de apresentação; manter canal `super-vpn` e confirmações do worker |
| Login oficial | `account/openForkTab.ts`, `account/fork/*`, `vpn/handleAccountFork.ts`, ponte `vpn-auth-bridge.js` | Abrir conta oficial; validar origem, estado pendente e resposta; nenhuma senha na interface |
| Sessão e renovação | `account/readSession.ts`, `saveSession.ts`, `refreshToken.ts` | Preservar UID e rotação de tokens; agrupar renovações; uma resposta antiga não deve restaurar sessão encerrada |
| Credenciais do proxy | `account/credentials/getConnectionCredentials.ts`, `storedCredentials.ts` | Obter credenciais de curta duração do serviço e renovar; mantê-las fora da interface e dos logs |
| Plano e servidores | `vpn/assertServerAccess.ts`, `getLogicals.ts`, `pickServerInLogical.ts` | Respeitar autorização, manutenção, disponibilidade e características do servidor |
| Regras e PAC | **Próprio:** `vpn/engine/routing.js` e `routing.d.ts` | Funções puras, sem armazenamento, rede ou credenciais; preservar os formatos consumidos pelo adaptador |
| Aplicação do proxy | `tools/proxy.ts` | Continuar usando `chrome.proxy.settings`; confirmar controle efetivo, atualizar autenticação e WebRTC |
| Autenticação de requisições | `vpn/initAuthInterceptor.ts`, `authHandler.ts`, `state.ts` | Responder somente a desafios de proxy conhecidos; não entregar credenciais a autenticação de sites |
| Estado e recuperação | `state.ts`, `vpn/initState.ts`, `recoverState.ts`, `initProxySettingsWatcher.ts` | Separar intenção de conexão, proxy realmente aplicado, sessão disponível e erro de rede |
| Indicador | `vpn-indicator.js` + núcleo próprio | Usar regras efetivas e verificar propriedade do proxy antes de mostrar verde |

Os caminhos não iniciados por `vpn/` nesta tabela são relativos a `vendor/proton-source/source/js/`.

## Contrato de sessão e armazenamento

O formato `Session` contém `uid`, `accessToken`, `refreshToken`, estado do fork/selector, indicador de persistência e metadados de renovação. São dados privados do adaptador; o núcleo de regras não os recebe.

| Dados | Armazenamento atual | Observação |
| --- | --- | --- |
| Sessão | `chrome.storage.local`, `superVpn:session` | A adaptação atual define `sessionDataStorageType` como local; os dois auxiliares de sessão apontam para o mesmo item. Revisar esse detalhe antes de substituir a persistência |
| Credenciais temporárias | local, `superVpn:credentials` | Cache com prazo e renovação; não é a senha digitada na página de login |
| Servidor em andamento | `chrome.storage.session`, `superVpn:connectedServer` | Sobrevive à suspensão do worker, mas não é garantia de continuidade após reiniciar o navegador |
| Escolhas/histórico | local, `superVpn:last-choice`, `superVpn:last-choices` | Usados por reconexão e histórico conforme as preferências |
| Regras | local, `superVpn:split-tunneling` | Listas por modo, estado habilitado e opção de subdomínios |
| Preferências | local, `superVpn:auto-connect`, `superVpn:secure-core`, entre outras | Manter IDs e valores durante cada migração |

O logout invalida a sessão, esquece credenciais/caches e remove o proxy pelo controlador atual. A futura implementação de sessão deverá preservar a proteção contra respostas de renovação que chegam depois do logout, sem migrar tokens para outro espaço de armazenamento nesta etapa.

## Núcleo de regras entregue

API pública, também descrita em `routing.d.ts`:

- `createFixedConfig(host, port, split, options)`: devolve `{ mode: 'fixed_servers', rules }`; recebe do adaptador o esquema e as exceções de API/rede local.
- `createPacScript(config, localExclusions)`: devolve `{ mode: 'pac_script', pacScript: { data } }`; valida o endpoint e serializa dados sem interpolá-los como código executável.
- `usesVpn(url, policy)`: avalia o endereço para o indicador, sem consultar DNS nem acessar o navegador.

`tools/proxy.ts` delega as duas primeiras funções ao núcleo próprio. O controlador mantém o modo `fixed_servers` para exclusão e usa PAC para inclusão. O host carrega `vpn/engine/routing.js` antes do indicador; o bundle Proton incorpora o mesmo código na compilação. Não há um segundo controlador escrevendo configurações de proxy em paralelo.

Inclusão mantém as exceções técnicas `.protonvpn.net` e `.protonvpn.com`; exclusões de API têm precedência. Domínio exato, subdomínio com prefixo `.`, porta e CIDR IPv4 têm regras explícitas. O PAC preserva o envio direto de nomes locais e faixas locais/reservadas; as exceções implícitas do Chromium para loopback/link-local também são consideradas. Seleção de servidor e controle de plano permanecem no adaptador.

A função de decisão é autocontida para poder ser serializada no PAC. Há teste após Babel e minificação de produção, além do teste da fonte. O indicador não faz resolução DNS: regras CIDR aplicadas a nomes resolvidos pelo PAC podem não ser comprovadas apenas pela URL da aba. O indicador descreve a política, não mede pacotes nem certifica IP.

## Recuperação mapeada

1. A inicialização consulta o servidor salvo na sessão e, se existir, configura temporariamente o endereço de espera `localhost:9` antes de recuperar o estado.
2. O controlador restaura sessão/usuário, renova credenciais e tenta reaplicar o servidor. Sem servidor salvo, considera a última escolha e a preferência de conexão automática.
3. Mudanças de regras reaplicam a configuração à conexão ativa. Falhas de rede e verificações periódicas continuam sendo tratadas pelo motor atual.
4. Perda de controle do proxy por outra extensão/política gera desconexão. O observador começava incorretamente marcado como registrado; em 1.6.5 ele passa a registrar o listener uma vez e permite remover/reinstalar.
5. Desconexão/logout removem a configuração desta extensão e restauram o controle WebRTC pelo adaptador existente.

Intervalos no worker não garantem execução enquanto ele está suspenso. Retomada do worker e reinício completo do navegador são cenários distintos. Esses fluxos foram mapeados no código; ainda exigem validação real antes da substituição do controlador.

## Próximas partes, em ordem

1. **Controlador próprio de proxy:** serializar conectar, atualizar regras e desconectar; validar endpoint também no modo fixo; confirmar `levelOfControl` e tratar erros de `settings.set/clear`. Reunir WebRTC e autenticação em adaptadores pequenos.
2. **Estado e recuperação próprios:** distinguir conectado, conectando, desconectado e sessão ausente; invalidar operações atrasadas com um identificador de geração; recuperar com eventos/alarmes adequados à suspensão do worker.
3. **Sessão própria:** encapsular fork, rotação de tokens, credenciais temporárias e persistência sem duplicar logins nem alterar as permissões da conta.
4. **Transporte e seleção:** migrar requisições, cache e seleção mantendo autorização e compatibilidade do serviço.

Cada substituição precisa de testes de contrato antes de retirar o caminho anterior e de teste real no Chromium antes de ser considerada validada. Esta etapa não implementa um protocolo VPN nem substitui a infraestrutura do Proton.

## Reconstrução e evidência

```sh
npm ci
npm run setup:vpn
npm run build:vpn
npm test
node vendor/proton-source/node_modules/typescript/bin/tsc --noEmit -p vpn/tsconfig.interface.json
```

A compilação completa inclui o núcleo próprio no worker e preserva `vpn/engine`. Os arquivos compilados são versionados. Fontes e avisos GPL permanecem em `vendor/proton-source` e `vpn/LICENSE`.

Os testes cobrem contratos de regras, precedência, inclusão vazia, CIDR, portas, origem técnica, geração segura de PAC, isolamento sem APIs do navegador, execução após minificação, delegação do adaptador, cores do indicador e registro do observador de controle. Eles usam simulação: login, IP, tráfego real e recuperação nativa continuam pendentes em [validacao.md](validacao.md).
