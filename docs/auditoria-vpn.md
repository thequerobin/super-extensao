# Auditoria de privacidade da VPN — 1.7.13

Revisão de código em 12 de novembro de 2026. **Não certificada como “100%” ou livre de vazamentos.** Foram corrigidos riscos no código e preparados testes nativos; a execução com Chromium real foi impedida pelo ambiente. Este documento distingue implementação, simulação e evidência real.

## Resultado

A extensão é um proxy do navegador, não uma VPN do sistema nem um firewall. A garantia exigida de nunca deixar passar tráfego, inclusive durante disputa de configurações, encerramento de sockets, desativação da extensão e falha do próprio navegador, precisa de controle no sistema operacional. Para esse requisito, use uma VPN do sistema com kill switch/firewall e valide o conjunto com captura de pacotes.

A 1.7.13 implementa uma política conservadora: requisições dos sites são pausadas durante conexão/recuperação ou falha detectada. A pausa abrange também os sites excluídos da VPN. A liberação normal depende de confirmação do proxy e de uma requisição HTTPS sem credenciais; liberar a rede sem VPN é uma ação explícita. A página de conta Proton e requisições iniciadas pela própria extensão são exceções de recuperação. Não se promete anonimato dessas exceções.

## Achados no código e tratamento

| Prioridade | Achado | Tratamento na 1.7.13 | Evidência |
| --- | --- | --- | --- |
| Crítica | Falhas permanentes/ausência de credenciais podiam encerrar a intenção e retirar o proxy | Estado ativo fica bloqueado, com erro e tentativa posterior; limpeza nativa arma bloqueio antes de retirar a configuração | Testes de máquina de estados, geração e guard; execução nativa pendente |
| Crítica | Troca do proxy por outra extensão chamava desconexão e restaurava acesso comum | Watcher aciona bloqueio e alerta; também verifica mudanças inesperadas mantidas sob o mesmo proprietário | Testes do watcher e núcleo; janela assíncrona residual |
| Crítica | Nudge legado enviava credenciais em cabeçalho HTTP e repetia sem guarda de sessão | Caminho removido do estado e convertido em fachada sem IO; credenciais permanecem no desafio do proxy verificado | Teste de ausência de envio e inspeção dos bundles |
| Alta | PAC sem `mandatory` podia aceitar fallback do navegador em erro de script | PAC obrigatório e leitura de volta inclui `mandatory`; destino protegido retorna só o proxy | Execução do PAC em VM; falha real de PAC pendente |
| Alta | `isInNet(host, ...)` no PAC podia resolver nomes por DNS para classificar redes locais | PAC não chama DNS; CIDR compara somente endereços literais | Teste com função DNS que falha se chamada |
| Alta | Notificações de falha dependiam da opção de avisos comuns | Aviso de privacidade separado, persistente e com tratamento de erro nativo; ícone vermelho e alerta no painel | Testes da notificação, indicador e DOM; apresentação pelo SO pendente |
| Alta | Proxy instalado era considerado suficiente para liberar/mostrar conexão | Bloqueio antes de buscar credenciais, confirmação do proxy, HEAD HTTPS sem cookies/credenciais para `protonvpn.com`, nova verificação antes da liberação | Testes de probe, timeout, geração e readback; serviço real pendente |
| Alta | Previsão de rede/preconexões não eram controladas | Preferência de previsão de rede desativada e confirmada enquanto o proxy está armado | Callback/API simulados; DNS real pendente |
| Alta | WebTransport não estava explicitamente coberto pela política do proxy | Regra persistente bloqueia WebTransport mesmo durante a sessão liberada | Regra/precedência simuladas; tráfego WebTransport real pendente |
| Alta | Cancelamento/timeout de autenticação do proxy podia encerrar só aquela requisição | Cancelamento de desafio do proxy atual aciona bloqueio e aviso, sem reagir a autenticação de sites ou estado antigo | Testes do adaptador real com IO simulado |
| Alta | Reinício completo apaga o servidor salvo em área de sessão | Bloqueador dinâmico permanece; a permissão de tráfego é regra de sessão e desaparece no reinício/atualização | Contratos e documentação oficial; reinício nativo pendente |
| Média | Snapshot podia aguardar IO e retornar confirmação antiga | Geração/identidade/estado de bloqueio revalidados depois da leitura de segurança | Testes de estado e interfaces |
| Média | Painel desconectado/logout não oferecia saída do bloqueio | Aviso e ação “Liberar rede sem VPN”, com confirmação de uso do IP real | Teste DOM de recusa e aprovação |

O probe indica alcance HTTPS pelo caminho configurado naquele momento, **não atesta IP de saída, todos os destinos ou tráfego futuro**. Indisponibilidade/redirect/bloqueio do site usado no probe pode manter uma VPN válida bloqueada. O teste real com a conta precisa confirmar esse contrato antes de aprovar uso como recurso de privacidade.

## Arquitetura de bloqueio

`vpn/engine/network-guard.ts` ordena operações e invalida liberações antigas. `vpn/networkGuard.ts` é o adaptador Chromium:

- Regra dinâmica `880001`, prioridade 10000: bloqueio HTTP/HTTPS/WS/WSS para requisições dos sites, incluindo navegação e subrecursos. Exceções: iniciador da própria extensão e domínios de conta Proton.
- Regra de sessão `880002`, prioridade 10001: permite o tráfego quando a recuperação foi confirmada. Reinício do navegador/atualização remove essa regra, mantendo o bloqueador dinâmico.
- Regra dinâmica `880003`, prioridade 11000: bloqueia novas conexões WebTransport enquanto a proteção está armada, inclusive quando a regra de sessão está liberada.
- Regras fora desses IDs são preservadas. Falha de escrita/readback/quota não é tratada como sucesso.
- Logout não libera a rede automaticamente. Desconexão explícita aguarda limpeza do proxy/privacidade antes de remover os bloqueadores, e respeita uma conexão nova que tenha substituído a operação.

O worker registra eventos de erro do proxy, falhas de autenticação, perda de propriedade, alterações de WebRTC e previsão de rede. A proteção WebRTC passa a ser obrigatória enquanto a VPN está ativa; preferências antigas desativadas não a desligam. Os alarmes continuam úteis para recuperação; não fornecem temporização rígida. O ícone vermelho comunica a interrupção/acionamento do bloqueio; não mede pacotes nem substitui a confirmação nativa.

Os scripts de montagem do PAC e o avaliador do indicador compartilham a mesma política. Remover DNS do PAC altera a resolução de intranets: nomes que antes eram descobertos como IP privado por DNS precisam de exclusão explícita por domínio se devam continuar fora do proxy. As exclusões voluntárias continuam sendo tráfego direto na operação saudável.

## Validação executada

- Suíte completa: **357 testes aprovados**, incluindo novos contratos de guard, WebTransport, timeout/probe, estado bloqueado, autenticação, previsão de rede, ícone e confirmação no painel.
- Compilação de produção, TypeScript do worker e interface, consistência de UI e `git diff --check` aprovados.
- Transporte, armazenamento, callbacks nativos e regras declarativas são simulados nesses testes. Não são captura de pacotes.
- Tentativa real com Chromium 156 e perfil temporário: **bloqueada**, com `socket() failed: Operation not permitted` na inicialização do navegador. Não houve login, conexão Proton, medição de IP/DNS nem confirmação de aplicação real das regras nesta rodada.

## Teste nativo reproduzível preparado

`scripts/check-vpn-native.cjs` cria uma extensão mínima com os módulos reais de guard/PAC e um perfil temporário. Usa servidores locais de origem/proxy e contabiliza pedidos diretos; nunca acessa conta ou perfil pessoal. Precisa de Playwright e Chromium instalados. Execute num ambiente com navegador/sockets permitidos:

```sh
node scripts/check-vpn-native.cjs
```

Em ambientes com outro executável, configure `CHROMIUM_PATH`. O runner cobre bloqueio antes da conexão, passagem pelo proxy, queda sem DIRECT, perda do proxy com bloqueio já armado, persistência do bloqueio após reinício e liberação explícita. Ele **não comprova janela zero na perda espontânea do proxy**, nem cobre TLS do proxy Proton, IP real, WebRTC/WebTransport existentes ou todos os eventos do navegador.

## Validação real obrigatória antes de aprovação

1. Conta de teste Free e, se utilizada, paga: login/MFA, troca manual, modo mais rápido, renovação e expiração de credenciais. Nenhuma credencial pode aparecer no console, URL ou pedido comum de página.
2. Captura no sistema de origem: HTTP, HTTPS, POST, uploads, SSE, WebSocket, WebRTC e WebTransport; IP e DNS antes/durante/depois da conexão. Verificar o que já estava aberto antes de ativar a VPN.
3. Derrubar o proxy, DNS e rede; alternar Wi-Fi/rede física; suspender computador e worker. Verificar bloqueio, aviso/ícone/painel e recuperação, sem envio direto dos destinos protegidos.
4. Substituir/remover o proxy durante requisições contínuas e medir a janela entre alteração e bloqueio. Repetir durante autenticação, troca de servidor e reconfiguração de inclusão/exclusão.
5. Reiniciar navegador e atualizar/recarregar a extensão com VPN ativa e com auto-connect ligado/desligado. Verificar regras dinâmicas/sessão antes do worker executar e a saída explícita quando não houver servidor recuperável.
6. Negar notificações no SO, privacidade ou permissão declarativa; simular quota/readback falso. Não pode aparecer proteção confirmada quando a configuração/bloqueio não for verificável. Com aviso do SO negado, verificar o alerta persistente e ícone vermelho.
7. Validar inclusões, exclusões, subdomínios, redirecionamentos, recursos de terceiros, IPs literais, IPv6, intranet, downloads e navegação anônima autorizada. A política é por destino; uma página pode carregar recursos de outros hosts fora da lista de inclusão.
8. Confirmar liberação explícita, recusa da confirmação, logout durante recuperação e ausência de aplicação/liberação tardia após nova conexão.

## Limites que impedem certificação de 100%

- A alteração/perda do proxy e a instalação/revogação de regras são operações assíncronas. Pode haver uma janela antes do evento/readback; a extensão não é uma transação atômica do firewall com o proxy.
- Regras de requisições não oferecem um mecanismo universal para encerrar sockets e fluxos já estabelecidos. Não se afirma que uma sessão WebRTC/WebSocket/WebTransport existente foi encerrada ao instalar uma regra.
- DNR cobre a pilha de requisições suportada pelo Chromium; não é firewall de todos os protocolos, processos, DNS do sistema, outras aplicações ou perfis não autorizados.
- Remover/desativar a extensão, revogar permissões e políticas do navegador/SO podem eliminar seu controle. Notificações podem ser bloqueadas pelo sistema.
- A verificação HTTPS não é prova independente de IP. O IP mostrado no cartão continua sendo metadado do servidor.
- O requisito de bloquear toda a rede com garantia fora da janela de eventos exige VPN/firewall no sistema operacional e validação de pacotes. Mesmo nesse caso, deve-se validar a configuração em vez de prometer infalibilidade.

## Fontes primárias consultadas

- [Chrome proxy API — PAC obrigatório e escopos](https://developer.chrome.com/docs/extensions/reference/api/proxy)
- [Chrome DNR — regras dinâmicas/sessão, precedência e tipos](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [Chromium — proxy, resolução de nomes e fallback](https://chromium.googlesource.com/chromium/src/+/HEAD/net/docs/proxy.md)
- [Chrome alarms — atrasos, suspensão e persistência](https://developer.chrome.com/docs/extensions/reference/api/alarms)
