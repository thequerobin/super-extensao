# Próxima etapa: validar a VPN no PC do usuário

Registrado em 12 de novembro de 2026, após a 1.7.17. **Atualizado na 1.7.19: runner local aprovado e medições parciais com Proton real realizadas.** A execução isolada ocorreu após pull de `573eedc`, no Microsoft Edge 157.0.4341.46, Windows, headless, com perfil temporário. A rodada autenticada usou Helium no Windows, com Chromium 157 informado pelo agente do navegador, extensão 1.7.19 carregada da pasta principal e fontes do commit `4ae6b9b`. Não considera a revisão de privacidade aprovada.

O objetivo é observar o navegador e o tráfego reais, complementando os 397 testes automatizados já aprovados. A validação de uso da 1.7.16 relatada pelo usuário fica preservada; não substitui medições de IP/DNS ou de falhas.

## Pendências de privacidade priorizadas — revisão de 13 de novembro de 2026

Referência de código: **1.7.24**. Esta revisão registra pontos válidos da análise complementar; não executa novos testes nem aprova a proteção sob falhas. Há riscos residuais identificados, mas não há taxa de vazamento medida que sustente classificar sua probabilidade como alta, baixa ou “não desprezível”.

### Alta prioridade

1. **Medir e reduzir a janela de bloqueio.** Medir alteração/perda espontânea do proxy → recebimento do evento → revogação da permissão de sessão `880002` → bloqueio efetivo de requisições. Em `vpn/engine/network-guard.ts`, `block()` entra na fila, aguarda `installBlock()` e só então chama `revoke()`. Como `880002` tem prioridade superior a `880001`, reinstalar o bloqueador não basta enquanto a permissão estiver presente. Avaliar antecipar a revogação sem permitir que uma liberação concorrente reabra o tráfego; validar falhas de API e operações atrasadas. O teste atual de perda de configuração arma o bloqueio antes de limpar o proxy e não mede essa corrida espontânea.
2. **Capturar tráfego durante falhas reais.** Testar pedidos contínuos durante queda do proxy/rede, troca de Wi-Fi, suspensão/retomada e reinício completo do navegador autenticado. Comparar IP de saída, DNS, IPv4/IPv6 e destinos protegidos, registrando qualquer tráfego direto indevido. O runner local e as medições externas saudáveis já passaram nos cenários registrados, mas não substituem captura contínua; o acesso ao `pktmon` foi negado na rodada anterior.
3. **Verificar fluxos já estabelecidos.** Distinguir conexões abertas antes de ativar a VPN de conexões estabelecidas pelo proxy. Testar WebSocket, WebRTC, WebTransport, SSE, downloads e uploads existentes ao entrar em bloqueio. A regra DNR não comprova encerramento desses fluxos; uma conexão TCP pelo proxy também não muda automaticamente para conexão direta quando ele cai. Avaliar aviso explícito para recarregar abas. Recarga automática é uma mitigação a estudar, sem garantia universal de encerramento, e pode perder formulários ou interromper operações; não repetir automaticamente POST ou pagamentos.

### Média prioridade

- **Completar cobertura IPv6 e DNS.** O PAC já evita resolver nomes para classificar redes locais. Validar destinos IPv6 literais, DNS de destinos protegidos e exceções, com referência antes/depois e captura sob falha. DNR não controla todo o DNS/IP do sistema. Forçar DoH ou bloquear DNS comum não é uma capacidade geral das APIs atuais da extensão; DoH, isoladamente, também não prova passagem pelo túnel.
- **Validar comunicação de risco no navegador e no SO.** Já existem ícone vermelho, alerta no painel, solicitação de notificação persistente e página local de bloqueio. Confirmar a apresentação quando notificações forem negadas e avaliar se o aviso explica suficientemente os limites de conexões antigas. A aparência de bloqueio não é evidência de ausência de tráfego.

### Já implementado; manter nos testes de regressão

- Bloqueio antes da limpeza do proxy, observação de `proxy.settings.onChange` e leitura de confirmação. Essas APIs são assíncronas; não há confirmação síncrona nem transação atômica entre proxy e DNR.
- Bloqueador **dinâmico persistente** `880001`, com permissão **de sessão** `880002` removida no reinício/atualização. Persistência passou no runner isolado; falta completar o cenário autenticado sob observação contínua.
- WebRTC obrigatório em `disable_non_proxied_udp`, confirmação por `get()` e observação de alterações enquanto a VPN está ativa.
- Bloqueio de sites excluídos durante emergência, mantendo as exceções documentadas de recuperação da extensão e dos domínios de conta Proton. Um modo adicional que retire essas exceções e exija liberação manual seria uma escolha futura de produto, não uma correção já demonstrada como necessária.
- Runner `scripts/check-vpn-native.cjs` executado com seis cenários aprovados e zero pedidos diretos antes da liberação explícita. Ele contabiliza pedidos locais e **não contém captura de pacotes**. Já há medições parciais de IP/DNS/WebRTC com Proton real, limitadas aos cenários descritos no registro abaixo.

### Evolução futura

Native Messaging com componente instalado e firewall do sistema pode ampliar o controle para além das APIs do navegador. Exige projeto, instalação e validação próprios; permanece fora das garantias da extensão atual. Para requisito de bloqueio forte no sistema, usar VPN de sistema com kill switch/firewall e validar a configuração com captura de tráfego.

Fontes de contrato das APIs: [ChromeSetting — eventos e operações assíncronas](https://developer.chrome.com/docs/extensions/reference/api/types), [DNR — persistência e precedência](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest), [privacy — WebRTC e previsão de rede](https://developer.chrome.com/docs/extensions/reference/api/privacy). A evidência histórica permanece em [validacao.md](validacao.md) e os limites em [auditoria-vpn.md](auditoria-vpn.md).

## Preparação na retomada

- [ ] Identificar a pasta do repositório e registrar commit, versão instalada, sistema operacional, navegador e versão.
- [ ] Confirmar que a extensão carregada corresponde aos arquivos desse commit e registrar regras de inclusão/exclusão, servidor e outras extensões que controlam proxy/privacidade.
- [ ] Verificar Node e disponibilidade de Playwright/Chromium para o runner. A compilação VPN da 1.7.17 requer Node >=24.11.0. Ajustar `CHROMIUM_PATH` ao executável realmente disponível.
- [ ] Começar com perfil temporário e destinos de teste. Separar o teste local sem conta da conferência com conexão Proton real; login/MFA, quando necessário, será feito pelo usuário.
- [ ] Preparar captura de tráfego e evidências sanitizadas. Não publicar tokens, cookies, IP residencial, dados de conta ou capturas pessoais no repositório público.

## Ordem de execução e critérios

| Etapa | O que executar | Evidência e comportamento esperado |
| --- | --- | --- |
| 1. Runner nativo isolado | Executar `node scripts/check-vpn-native.cjs` em ambiente com navegador e sockets permitidos | Registrar saída e falhas. Comprovar bloqueio antes de conectar, passagem pelo proxy local, ausência de fallback direto após queda, bloqueio após perda da configuração, persistência após reinício e liberação explícita. Não usa conta pessoal nem comprova o túnel Proton. |
| 2. IP, DNS e WebRTC | Registrar referência sem VPN; conectar à Proton e medir novamente nos destinos protegidos | Comparar tráfego e medições externas, inclusive IPv4/IPv6. Verificar exposição do IP de origem e consultas DNS associadas aos destinos protegidos. Testar WebRTC e distinguir conexões novas de sessões já estabelecidas. O IP do cartão e o indicador não bastam como prova. |
| 3. Queda e aviso | Durante pedidos contínuos, interromper rede/proxy e observar recuperação | Medir eventual janela de tráfego direto; verificar interrupção dos pedidos protegidos, aviso de privacidade, ícone e acesso à página local. Registrar também o comportamento dos fluxos já abertos. A tela bloqueada sozinha não comprova ausência de vazamento. |
| 4. Troca e retorno | Trocar servidor, suspender/retomar o PC e reiniciar navegador/worker | Confirmar que a intenção correta é recuperada, sem alternância indevida de servidores, navegação direta silenciosa ou tela conectada baseada em estado antigo. Conferir bloqueio antes da confirmação e regras dinâmicas/de sessão no reinício. |
| 5. Reconectar ou liberar | Usar “Tentar reconectar”; depois testar cancelamento e confirmação de “Liberar navegação sem VPN” | Reconectar mantém o bloqueio até validar a VPN. Cancelar a liberação não muda a proteção; confirmar desconecta e libera explicitamente. A página só informa sucesso após confirmação real. Não repetir automaticamente POST, formulários ou pagamentos. |
| 6. Regras por site | Repetir com inclusão/exclusão, subdomínios e recursos de terceiros | Registrar quais destinos devem usar proxy ou conexão direta na operação saudável. Durante bloqueio de emergência, também os sites excluídos devem ser pausados, respeitando as exceções documentadas de recuperação. |

Se um cenário revelar tráfego direto indevido, estado conectado incorreto ou liberação sem confirmação, registrar a reprodução e corrigir antes de considerar essa etapa concluída. Se não for possível medir, marcar como **inconclusivo**, sem converter ausência de evidência em aprovação. Considerar os limites de sockets existentes, DNR e controle pelo sistema operacional descritos na [auditoria](auditoria-vpn.md).

## Registro dos resultados

Evidências de 12 de novembro de 2026. As medições externas foram observadas pelo agente; a reconexão após recarregar a extensão foi confirmada pelo usuário. IPs, identificador de conta e credenciais foram omitidos.

| Cenário | Ambiente/commit | Esperado | Observado | Evidência sanitizada | Resultado |
| --- | --- | --- | --- | --- | --- |
| Runner local | Windows / Edge 157.0.4341.46 / fontes 1.7.19 | Conforme etapa 1 | Seis cenários passaram após corrigir a diretiva PAC HTTP para PROXY | `native:true`, `directRequestsBeforeRelease:0`; detalhes em validacao.md | Aprovado no cenário observado |
| IP/DNS/WebRTC | Windows / Helium, Chromium 157 / 1.7.19, `4ae6b9b` | Conforme etapa 2 | Cloudflare: referência BR/GRU sem VPN, US/MIA em US-FREE#95 e CA/YUL em CA-FREE#30, com IP diferente em cada medição. BrowserLeaks no servidor dos EUA: WebRTC “No Leak”, endereços WebRTC local/público ausentes; DNS: oito resolvedores, Datacamp/CDN77, Miami | Resultados externos lidos pela interface; sem captura de pacotes nem comparação de referência DNS/IPv6 | Aprovado nas medições observadas; cobertura completa de IPv6/DNS e tráfego sob falha inconclusiva |
| Queda/bloqueio/aviso | Windows / Helium / 1.7.19 | Conforme etapa 3 | Após salvar regras, ocorreram bloqueios e uma navegação excluída abriu a página local; não foi induzida queda física da rede | Aviso e redirecionamento observados; `pktmon status` negou acesso inclusive fora da sandbox | Página observada; captura contínua e comportamento de sockets existentes pendentes |
| Troca de servidor | Windows / Helium / 1.7.19, `4ae6b9b` | Conexão e tráfego devem acompanhar a seleção | Troca US-FREE#95 (Miami) para CA-FREE#30 (Montreal); painel conectado e medição externa mudou para CA/YUL com outro IP | Cloudflare e painel observados; indicador distinguiu página externa protegida de página interna | Aprovado no cenário observado; transição não monitorada continuamente |
| Recarga da extensão | Windows / Helium / 1.7.19, `4ae6b9b` | Recuperar conexão após reiniciar o worker | Agente acionou Recarregar nos detalhes da extensão; a ferramenta de controle interrompeu a observação. Em seguida o usuário confirmou “conectou” | Confirmação relatada pelo usuário; sem nova medição externa após a recarga | Reconexão relatada; preservação do servidor e proteção durante a transição inconclusivas |
| Suspensão/reinício do navegador | A preencher | Conforme etapa 4 | Não executado com conta real | Pendente | Pendente |
| Reconexão/liberação | Windows / Helium / 1.7.19 | Conforme etapa 5 | “Tentar reconectar” informou bloqueio durante a tentativa e depois “Conexão VPN confirmada”; outras tentativas permaneceram bloqueadas antes da recuperação posterior | Página real observada; tráfego saudável medido na repetição posterior | Recuperação observada; liberação explícita/cancelamento e proteção contínua pendentes |
| Inclusões/exclusões | Windows / Helium / 1.7.19, código `4ae6b9b`, documentação-base `738b7d6` | Conforme etapa 6 | Excluir cloudflare.com com subdomínios: www saiu BR/GRU. Incluir o mesmo domínio: raiz e www saíram US/MIA; one.one.one.one, fora da lista, saiu BR/GRU. Após restaurar, one.one.one.one voltou a US/MIA | Diagnósticos externos com timestamps novos e indicadores correspondentes; listas temporárias removidas e “Regras salvas” confirmado | Aprovado nos destinos estáveis observados; recursos de terceiros e transições sob captura pendentes |

Usar “aprovado no cenário observado”, “reprovado” ou “inconclusivo”, com limitações. Mesmo resultados positivos não certificam infalibilidade da extensão nem equivalência a um firewall do sistema.

A sessão inicial apresentou `Missing refresh token`; após o usuário sair e autenticar novamente, a conta e a lista de servidores carregaram e as medições acima foram realizadas. A página de detalhes confirmou versão 1.7.19 e origem `OneDrive/Documentos/super-extensao`. Malwarebytes, uBlock Origin e Proton Pass também estavam presentes; não foi verificado se alguma dessas extensões ou uma política do dispositivo controla preferências de privacidade. A interface indicou proteção WebRTC controlada pelo dispositivo. As regras começaram em exclusão sem domínios, foram alteradas temporariamente com autorização do usuário e terminaram restauradas: ambas as listas vazias, modo de exclusão e regras ativadas. A medição final confirmou tráfego pela VPN em US/MIA.

O controle do computador foi interrompido repetidamente por não conseguir determinar a URL atual com confiança suficiente para aplicar sua política. As retomadas permitiram observar a página de recuperação e concluir as medições estáveis de regras descritas acima. O runner isolado foi repetido com seis cenários aprovados e zero pedidos diretos antes da liberação, e os nove contratos de roteamento passaram. Queda real com medição contínua, suspensão, reinício completo do perfil autenticado, liberação/cancelamento e recursos de terceiros continuam pendentes. Detalhes da repetição em [validacao.md](validacao.md#repetição-no-helium-regras-por-site-e-recuperação).

Depois desta validação e de eventuais correções, retomar os **31 alertas baixos/moderados das ferramentas de desenvolvimento** por grupos, com atualização e testes específicos. O snapshot e as versões estão em [vpn-dependencias.md](vpn-dependencias.md).
