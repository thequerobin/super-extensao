# Super Extensão — guia rápido (1.6.9)

Revisado em 11 de novembro de 2026. Para os detalhes técnicos, permissões, créditos e desenvolvimento, consulte o [README](README.md). O trabalho restante está em [PROXIMOS-PASSOS.md](PROXIMOS-PASSOS.md).

A interface agora usa componentes comuns no popup, sincronização, VPN, editor da nova guia e aba de reserva. Os fluxos e as configurações existentes foram preservados. A instalação continua usando a pasta sem compactação; após atualizar, recarregue a extensão e abra novamente suas páginas.

## Instalar e atualizar

1. Extraia o ZIP ou clone o repositório e guarde a pasta em local permanente.
2. No Helium/Chromium, abra `chrome://extensions/` e ative **Modo do desenvolvedor**.
3. Use **Carregar sem compactação** e selecione a pasta com `manifest.json`.
4. Ao atualizar os arquivos, clique em **Recarregar** no cartão da extensão. Recarregue os sites abertos e abra uma nova guia.

A instalação já inclui os arquivos compilados e não exige Node.js. Desative extensões que dupliquem essas rotinas ou disputem a Nova guia/proxy. Para uso anônimo, autorize a extensão separadamente no navegador.

## Onde configurar

| Local | Configuração |
| --- | --- |
| Cabeçalho | Tema e idioma globais |
| Limpeza | Tipos de dados, cookies protegidos, importação de domínios, pausa e limpeza manual |
| Autoplay | Padrão de reprodução e regras por site |
| Abas | Proteção da última aba e comportamento da Nova guia |
| Sincronização | Perfis, serviços, backup e credenciais OAuth |
| VPN | Conta Proton, conexão, servidores e regras de tunelamento dividido |
| Engrenagem da Nova guia | Fundos, widgets e importação/exportação do dashboard |

Arraste a alça inferior para ajustar a altura do popup. O menu fica fixo enquanto o conteúdo rola.

## Google Drive e motor próprio

Configure o cliente OAuth em **Sincronização → Conexões** e autorize o perfil. Use o botão normal **Sincronizar**: os perfis Google Drive de favoritos passam a usar o núcleo próprio. O painel de comparação foi removido.

O motor preserva a criptografia e mantém backup/checkpoints locais para retomar interrupções. Se o mesmo item mudar de forma incompatível nos dois lados, o perfil mostra um conflito em vez de sobrescrever uma versão. Confira os itens ou use **Enviar/Receber uma vez** nas ações avançadas; a proteção de exclusão continua válida.

Demais provedores e perfis de abas ainda usam o motor anterior. Pastas sobrepostas entre perfis não são suportadas pelo núcleo próprio. Ainda falta validação real da conta Google e uma tela de restauração dos backups. [Escopo e limites](docs/sync-engine.md).

Backup de perfis pode conter credenciais e não equivale a backup dos favoritos.

## VPN e sinal no ícone

Faça login com a conta Proton na página oficial. Servidores ficam agrupados por país; as regras por domínio são configuradas em **Recursos → Tunelamento dividido**.

- **Verde com visto:** endereço da aba roteado para a VPN conectada.
- **Azul com traço:** VPN conectada, mas o endereço está fora do túnel.
- **Sem sinal:** sem conexão confirmada.

O sinal não mede tráfego nem verifica o IP externamente. O proxy cobre este navegador, e o serviço continua autorizando as conexões conforme a conta. [Detalhes](docs/proton-vpn.md).

## Cuidados de uso

- Para encerrar o navegador e iniciar a limpeza ao sair, feche a janela pelo **X** ou use **Sair**.
- Exceções protegem somente cookies; cache e localStorage selecionados ainda são apagados.
- A importação de domínios de favoritos é manual e não altera os favoritos.
- A importação da Nova guia substitui sua configuração; imagens próprias precisam ser selecionadas novamente.

A suíte da implementação 1.6.6 passou 148 testes simulados. O usuário confirmou a sincronização Google Drive na 1.6.2; tráfego VPN, recuperação após falhas e conferência visual ainda têm verificações pendentes. Consulte [o checklist de validação](docs/validacao.md).

Para imagens Unsplash/GIPHY, abra as opções do fundo na Nova guia e salve sua chave de API. Ela fica apenas neste dispositivo. Veja [as instruções de imagens](docs/newtab-images.md).
