# Proton VPN na Super Extensão — referência 1.7.0

A interface ativa agora é própria da Super Extensão, em `vpn/source`, com as telas Conexão, Servidores, Recursos e Conta. O serviço e o protocolo de login permanecem Proton; regras/PAC, controlador de proxy, máquina de estados, restauração/recuperação, gerações, alarmes e persistência/rotação de tokens usam o núcleo próprio de `vpn/engine`. Credenciais temporárias, transporte, WebRTC e seleção de servidores continuam em adaptadores. Veja [arquitetura, reconstrução e validação](../docs/vpn-interface.md).

## Usar

1. Atualize os arquivos da extensão e clique em **Recarregar** em `chrome://extensions` (ou no gerenciador do Helium).
2. Abra a Super Extensão, selecione **VPN** e clique em **Entrar com a conta Proton**. A permissão de proxy já declarada pelo app não exige um novo aviso quando já concedida.
3. Entre na sua conta na página oficial do Proton. A senha é digitada no Proton; a Super Extensão recebe a sessão de autorização.
4. Na tela **Conexão**, abaixo de **País mais rápido**, abra **Servidores gratuitos** para ver todos os servidores Free retornados pela API, com bandeira, ocupação e indicação de manutenção. Clique em um servidor disponível para conectar. Você também pode escolher um país e um servidor disponível para o seu plano. Em contas Free, o seletor completo permite escolher os servidores gratuitos retornados pela API. Servidores pagos continuam restritos.
5. Em **Recursos → Tunelamento dividido**, escolha excluir sites da VPN ou usar a VPN apenas nos sites listados. As regras podem incluir subdomínios. Salvar uma alteração também atualiza a conexão ativa.

O proxy vale para o tráfego deste navegador. Não altera a rede dos demais aplicativos. A disponibilidade de servidores e a autorização de conexão continuam sob controle do Proton.

## Configurações e integração

- Painel da VPN com a paleta, tipografia, bordas e botões da Super Extensão. Layout fluido no painel incorporado.
- A extensão reabre na seção anterior. A VPN também lembra a página estável aberta e sua rolagem; as páginas estáveis são Conexão, Servidores, Recursos e Conta.

- Tema escuro, claro ou sistema compartilhado com a preferência global da Super Extensão.
- Dados persistentes de sessão e preferências usam `chrome.storage.local`, sob `superVpn:`; o motor também usa armazenamento de sessão para estado de conexão. Tokens não são enviados ao Floccus nem incluídos na sincronização de favoritos.
- Mensagens internas no canal `super-vpn`, separado de `super-sync` e da limpeza.
- Permissões adicionadas: proxy, privacy, idle, scripting, webRequest e webRequestAuthProvider. Elas suportam o proxy, autenticação, recuperação e proteção WebRTC do módulo original.
- Ponte Chromium na página oficial: encaminha a resposta de login à Super Extensão somente quando o estado foi gerado por ela; logins da extensão oficial mantêm o caminho original. Não encaminha senhas, chaves privadas ou tokens de sessão à página.
- Relay de autorização apenas em `https://account.proton.me/` e `https://account.protonvpn.com/`, para mensagens de sessão `fork`, mantendo a validação do estado de autorização.
- Telemetria e relatórios Sentry desativados. O host desenha um sinal verde/azul no canto superior direito do ícone, conforme a conexão e o endereço da aba; o badge de pausa da limpeza permanece independente.
- Fonte GPL-3.0 do Proton mantida em `vendor/proton-source`, baseada no commit `71d7d86f164a2ee8e50ce5a389c9e5cbe0fd6883`.

## Validação

A implementação 1.5.19 registrou 71 testes da suíte completa, com APIs simuladas e testes DOM; eles incluem seleção por plano, regras, isolamento de dados, rejeição de mensagens indevidas e o indicador por aba. A ponte da interface passou pela checagem TypeScript. [Cobertura e verificações pendentes](../docs/validacao.md).

O ambiente de desenvolvimento bloqueou a inicialização do Chromium com extensões (`socket() failed: Operation not permitted`). Não foram validados visualmente login, conexão real, mudança de IP, aplicação das regras no tráfego ou recuperação da VPN após reiniciar. Esses fluxos precisam de teste no navegador do usuário com uma conta Proton antes de considerar a integração validada para uso diário.

## Reconstruir

```sh
npm ci
npm run setup:vpn
npm run build:vpn
npm test
```

Os arquivos compilados são incluídos no repositório; instalar a extensão descompactada não exige Node.js.

## Trabalho restante

A reescrita parcial avançou na 1.7.0 com controlador próprio, invalidação de operações tardias, alarmes e persistência/renovação de sessão. A 1.7.4 extrai a máquina de estados, a restauração e a política de retries; credenciais temporárias, transporte, WebRTC e seleção de servidores ainda precisam de extração. Veja [vpn-engine.md](../docs/vpn-engine.md) e [PROXIMOS-PASSOS.md](../PROXIMOS-PASSOS.md).
