# Proton VPN na Super Extensão 1.5.0

## Usar

1. Atualize os arquivos da extensão e clique em **Recarregar** em `chrome://extensions` (ou no gerenciador do Helium).
2. Abra a Super Extensão e selecione **VPN**.
3. Entre na sua conta na página oficial do Proton. A senha é digitada no Proton; a Super Extensão recebe a sessão de autorização.
4. Escolha um país e um servidor disponível para o seu plano. Em contas Free, o seletor completo permite escolher os servidores gratuitos retornados pela API. Servidores pagos continuam restritos.
5. Em **Recursos → Tunelamento dividido**, escolha excluir sites da VPN ou usar a VPN apenas nos sites listados. As regras podem incluir subdomínios. Salvar uma alteração também atualiza a conexão ativa.

O proxy vale para o tráfego deste navegador. Não altera a rede dos demais aplicativos. A disponibilidade de servidores e a autorização de conexão continuam sob controle do Proton.

## Configurações e integração

- Tema escuro, claro ou sistema compartilhado com a preferência global da Super Extensão.
- Sessão, servidores e regras em `chrome.storage.local`, sob `superVpn:`. Tokens não são enviados ao Floccus nem incluídos na sincronização de favoritos.
- Mensagens internas no canal `super-vpn`, separado de `super-sync` e da limpeza.
- Permissões adicionadas: proxy, privacy, idle, scripting, webRequest e webRequestAuthProvider. Elas suportam o proxy, autenticação, recuperação e proteção WebRTC do módulo original.
- Relay de autorização apenas em `https://account.proton.me/` e `https://account.protonvpn.com/`, para mensagens de sessão `fork`, mantendo a validação do estado de autorização.
- Telemetria e relatórios Sentry desativados. Ícone e badge do painel principal preservados.
- Fonte GPL-3.0 do Proton mantida em `vendor/proton-source`, baseada no commit `71d7d86f164a2ee8e50ce5a389c9e5cbe0fd6883`.

## Validação

Compilação de produção com verificação TypeScript e 24 testes automatizados, cobrindo também seleção por plano, tunelamento em contas Free, isolamento de dados e rejeição de mensagens indevidas.

O ambiente de desenvolvimento bloqueou a inicialização do Chromium com extensões (`socket() failed: Operation not permitted`). Não foram validados visualmente login, conexão real, mudança de IP, aplicação das regras no tráfego ou recuperação da VPN após reiniciar. Esses fluxos precisam de teste no navegador do usuário com uma conta Proton antes de considerar a integração validada para uso diário.

## Reconstruir

```sh
npm ci
npm run setup:vpn
npm run build:vpn
npm test
```

Os arquivos compilados são incluídos no repositório; instalar a extensão descompactada não exige Node.js.
