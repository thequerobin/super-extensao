# Integração na Super Extensão 1.5.0

Origem: https://github.com/ProtonVPN/proton-vpn-browser-extension
Commit upstream: 71d7d86f164a2ee8e50ce5a389c9e5cbe0fd6883 (1.3.6).
Licença original: GPL-3.0, preservada em LICENSE.

Alterações locais:
- Histórico local de conexões recentes disponível para contas Free e pagas, com controle para desativar e apagar o histórico.
- Tema visual da Super Extensão em `vpn-theme.css`, painel fluido e memória da página e rolagem da VPN.
- Ponte de login Chromium para o ID próprio da Super Extensão: estado local obrigatório, resposta ao solicitante e preservação do fluxo de outras extensões.
- Tela de entrada com identidade da Super Extensão, orientação para usar a conta Proton e botão de login direto. Solicitação de proxy limitada às origens HTTP/HTTPS declaradas no manifesto, com erros e recusa de permissão visíveis.
- Interface completa (`simplifiedUi=false`) para selecionar os servidores autorizados pelo plano; a verificação de tier continua na UI e também ocorre no worker antes de conectar.
- Tunelamento dividido local para contas Free e pagas, incluindo os modos incluir e excluir, persistência e atualização da conexão ativa.
- Ativos compilados em `vpn/`, worker compartilhado e mensagens em `super-vpn`.
- Armazenamento em `superVpn:`, sem acesso às preferências dos demais módulos.
- Tema global escuro/claro/sistema, sem configuração de tema independente para a VPN.
- Relay de login MV3 restrito às origens exatas account.proton.me e account.protonvpn.com e a mensagens fork; validação de state mantida pelo Proton.
- Sem abertura automática de onboarding, alteração do ícone global, telemetria ou envio de relatórios Sentry.
- Guarda temporária de tráfego na inicialização somente quando houver uma conexão VPN anterior a recuperar.

O manifesto original é referência de compilação; o manifesto da Super Extensão controla permissões e identidade da extensão integrada. A identidade pública da extensão oficial não é copiada.
