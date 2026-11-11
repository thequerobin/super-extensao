# Interface própria da VPN — 1.5.10

A aba VPN usa `vpn/source`, sem montar o HTML, JavaScript ou CSS do popup original. O motor, a autenticação, os servidores e a autorização de plano continuam sendo do Proton. O worker não foi alterado nesta etapa.

## Telas

- **Conexão:** estado confirmado pelo worker, conexão automática ao país mais rápido, servidor aleatório, desconexão/cancelamento, lista de servidores gratuitos e conexões recentes quando ativadas.
- **Servidores:** pesquisa por país, cidade ou nome; filtros Meu plano, Gratuitos, Todos e Secure Core; ocupação e manutenção. Contas Free continuam limitadas aos servidores gratuitos. A interface pagina a renderização para não inserir milhares de botões de uma vez.
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

A inicialização do Chromium permanece bloqueada no ambiente por `socket() failed: Operation not permitted`. Os testes DOM e de tipos não substituem a validação visual no Helium/Chromium nem validam login real, mudança de IP, tráfego por domínio ou recuperação da conexão. Esses pontos continuam pendentes antes de considerar a VPN validada para uso diário.
