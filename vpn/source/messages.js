/* SPDX-License-Identifier: GPL-3.0-only */
export const messages = {
  domainsLabel: {"pt-BR": "domínios", en: "domains"},
  featuresLoading: {"pt-BR": "Aguardando carregar os recursos e os dados da conta…", en: "Waiting for features and account details to load…"},
  featuresLoadFailed: {"pt-BR": "Não foi possível concluir o carregamento dos recursos e da conta. Tente novamente para habilitar as opções disponíveis.", en: "Could not finish loading features and account details. Retry to enable available options."},
  bookmarkHelp: {"pt-BR": "A importação copia apenas domínios HTTP/HTTPS e não altera os favoritos. Mudanças futuras na pasta não atualizam esta lista. Revise e clique em Salvar para aplicar. A opção de subdomínios acima vale para os novos itens.", "en": "Import copies only HTTP/HTTPS domains without changing bookmarks. Future folder changes do not update this list. Review and click Save to apply. The subdomains option above applies to new entries."},
  bookmarkExclude: {"pt-BR": "No modo de exclusão, estes sites navegarão fora da VPN quando o tunelamento dividido estiver ativo.", "en": "In exclusion mode, these sites will bypass the VPN when split tunneling is enabled."},
  bookmarkInclude: {"pt-BR": "No modo de inclusão, somente os sites incluídos usarão a VPN quando o tunelamento dividido estiver ativo.", "en": "In inclusion mode, only included sites will use the VPN when split tunneling is enabled."},

  blocked: { "pt-BR": "Conexão não concluída", en: "Connection failed" },
  VpnConnectionTimedOut: {
    "pt-BR": "A VPN não confirmou a conexão em 30 segundos. A navegação permanece bloqueada. Tente novamente ou escolha outro servidor.",
    en: "The VPN did not confirm the connection within 30 seconds. Browsing remains blocked. Try again or choose another server.",
  },
  protectionDetails: {
    "pt-BR": "Ver proteção e recuperação",
    en: "Protection and recovery",
  },
  VpnStorageReadTimedOut: {
    "pt-BR":
      "O armazenamento da VPN não respondeu a tempo. Tente consultar novamente; o último estado exibido pode estar desatualizado.",
    en: "VPN storage did not respond in time. Query again; the last displayed state may be outdated.",
  },
  VpnStorageWriteTimedOut: {
    "pt-BR":
      "A gravação não foi confirmada a tempo e ainda pode terminar. Consulte o estado antes de repetir; a fila de segurança foi preservada.",
    en: "The write was not confirmed in time and may still finish. Check state before repeating; the safety queue was preserved.",
  },
  VpnStorageFailed: {
    "pt-BR":
      "O armazenamento da VPN está indisponível. Verifique o estado e tente consultar novamente.",
    en: "VPN storage is unavailable. Check state and query again.",
  },
  VpnWorkerTimedOut: {
    "pt-BR":
      "O serviço da VPN não respondeu a tempo. O estado não está confirmado; tente consultar novamente.",
    en: "The VPN worker did not respond in time. State is unconfirmed; query again.",
  },
  VpnWorkerUnavailable: {
    "pt-BR":
      "Não foi possível comunicar com o serviço da VPN. Uma ação enviada pode ainda terminar; consulte o estado antes de repetir.",
    en: "Could not communicate with the VPN worker. A submitted action may still finish; check state before repeating.",
  },
  VpnOperationPending: {
    "pt-BR":
      "A ação ainda não foi confirmada e pode terminar depois. Consulte o estado antes de repetir; nenhuma repetição automática foi enviada.",
    en: "The action is unconfirmed and may finish later. Check state before repeating; no automatic retry was sent.",
  },
  VpnOperationCancelled: {
    "pt-BR":
      "A consulta foi descartada porque o estado da VPN mudou. Consulte novamente.",
    en: "The query was discarded because VPN state changed. Query again.",
  },
  unconfirmed: { "pt-BR": "Estado não confirmado", en: "State unconfirmed" },
  VpnNetworkPredictionFailed: {
    "pt-BR":
      "Não foi possível desativar a previsão de rede/DNS do navegador. A navegação foi pausada.",
    en: "Could not disable speculative browser networking/DNS. Browsing has been paused.",
  },
  VpnTrafficGuardProbeBypassed: {
    "pt-BR":
      "A verificação da VPN foi excluída do túnel. Remova protonvpn.com da lista de exclusões.",
    en: "The VPN verification is excluded from the tunnel. Remove protonvpn.com from the exclusion list.",
  },
  VpnTrafficBlocked: {
    "pt-BR":
      "VPN interrompida: rede dos sites bloqueada até reconectar ou liberar sem VPN.",
    en: "VPN interrupted: website networking is blocked until reconnection or explicit release without VPN.",
  },
  VpnTrafficGuardFailed: {
    "pt-BR":
      "Falha ao confirmar o bloqueio de rede. A proteção não está garantida. Interrompa a navegação e verifique as permissões.",
    en: "Network blocking could not be confirmed. Protection is not guaranteed. Stop browsing and check permissions.",
  },
  VpnTrafficGuardUnavailable: {
    "pt-BR":
      "A permissão de bloqueio de rede não está disponível. A VPN não pode iniciar com segurança.",
    en: "Network-blocking permission is unavailable. The VPN cannot start safely.",
  },
  blockedHelp: {
    "pt-BR":
      "Por segurança, durante falhas a pausa abrange todos os sites, inclusive os excluídos da VPN. A página de conta Proton e chamadas da extensão são exceções de recuperação.",
    en: "During failures the safety pause covers all websites, including VPN exclusions. The Proton account page and extension requests remain available for recovery.",
  },
  releaseNetwork: {
    "pt-BR": "Liberar rede sem VPN",
    en: "Release networking without VPN",
  },
  confirmRelease: {
    "pt-BR": "Liberar a rede sem VPN? Os sites poderão usar seu IP real.",
    en: "Release networking without VPN? Websites may use your real IP.",
  },
  VpnProxyControlledElsewhere: {
    "pt-BR": "Outra extensão ou uma política do navegador controla o proxy.",
    en: "Another extension or a browser policy controls the proxy.",
  },
  VpnProxyNotApplied: {
    "pt-BR":
      "O navegador não confirmou a configuração da VPN. Tente conectar novamente.",
    en: "The browser did not confirm the VPN configuration. Try connecting again.",
  },
  VpnProxyClearFailed: {
    "pt-BR":
      "Não foi possível confirmar a remoção do proxy. Tente desconectar novamente.",
    en: "Could not confirm removal of the proxy. Try disconnecting again.",
  },
  VpnProxyApiError: {
    "pt-BR": "O navegador não conseguiu alterar as configurações de proxy.",
    en: "The browser could not change the proxy settings.",
  },
  VpnProxyUnavailable: {
    "pt-BR": "A permissão de proxy não está disponível neste navegador.",
    en: "Proxy access is unavailable in this browser.",
  },
  VpnInvalidProxyEndpoint: {
    "pt-BR":
      "O endereço ou a porta do servidor é inválido. Atualize a lista de servidores.",
    en: "The server address or port is invalid. Refresh the server list.",
  },
  VpnWebRTCProtectionUnavailable: {
    "pt-BR":
      "Não foi possível ativar a proteção WebRTC. Verifique as permissões do navegador.",
    en: "Could not enable WebRTC protection. Check browser permissions.",
  },
  VpnWebRTCSettingsFailed: {
    "pt-BR": "O navegador não conseguiu atualizar a proteção WebRTC.",
    en: "The browser could not update WebRTC protection.",
  },
  VpnSessionStorageFailed: {
    "pt-BR":
      "Não foi possível salvar ou ler a sessão da VPN neste dispositivo.",
    en: "Could not save or read the VPN session on this device.",
  },
  VpnInvalidSessionResponse: {
    "pt-BR":
      "O serviço retornou uma sessão inválida. Entre na conta novamente.",
    en: "The service returned an invalid session. Sign in again.",
  },
  VpnSessionUnavailable: {
    "pt-BR": "Entre na conta Proton para conectar.",
    en: "Sign in to your Proton account to connect.",
  },
  VpnSignInInvalidResponse: {
    "pt-BR": "Não foi possível obter um endereço válido para entrar na Proton. Tente novamente.",
    en: "Could not obtain a valid Proton sign-in address. Please try again.",
  },
  VpnSignInSuperseded: {
    "pt-BR":
      "Este pedido de login foi cancelado por outra ação. Inicie o login novamente.",
    en: "This sign-in request was superseded. Start signing in again.",
  },
  heading: {
    "pt-BR": "VPN no navegador",
    en: "Browser VPN",
  },
  intro: {
    "pt-BR": "Navegue com a conexão do Proton.",
    en: "Browse using a Proton connection.",
  },
  connection: {
    "pt-BR": "Conexão",
    en: "Connection",
  },
  servers: {
    "pt-BR": "Servidores",
    en: "Servers",
  },
  features: {
    "pt-BR": "Recursos",
    en: "Features",
  },
  account: {
    "pt-BR": "Conta",
    en: "Account",
  },
  loadingServers: { "pt-BR": "Carregando servidores…", en: "Loading servers…" },
  loadingAccount: { "pt-BR": "Consultando conta…", en: "Loading account…" },
  loading: {
    "pt-BR": "Carregando VPN…",
    en: "Loading VPN…",
  },
  retry: {
    "pt-BR": "Tentar novamente",
    en: "Try again",
  },
  wait: {
    "pt-BR": "Aguarde…",
    en: "Please wait…",
  },
  loginTitle: {
    "pt-BR": "Sua conexão, em um só lugar",
    en: "Your connection, in one place",
  },
  loginHelp: {
    "pt-BR": "Entre com sua conta Proton para usar a VPN.",
    en: "Sign in with your Proton account to use the VPN.",
  },
  login: {
    "pt-BR": "Entrar com a conta Proton",
    en: "Sign in with Proton",
  },
  provider: {
    "pt-BR": "Conexão fornecida pelo Proton · Somente neste navegador",
    en: "Connection provided by Proton · This browser only",
  },
  connected: {
    "pt-BR": "Conectado",
    en: "Connected",
  },
  connecting: {
    "pt-BR": "Conectando…",
    en: "Connecting…",
  },
  disconnected: {
    "pt-BR": "Desconectado",
    en: "Disconnected",
  },
  connect: {
    "pt-BR": "Conectar",
    en: "Connect",
  },
  disconnect: {
    "pt-BR": "Desconectar",
    en: "Disconnect",
  },
  cancel: {
    "pt-BR": "Cancelar",
    en: "Cancel",
  },
  fastest: {
    "pt-BR": "País mais rápido",
    en: "Fastest country",
  },
  fastestHelp: {
    "pt-BR":
      "Escolha automática entre os servidores disponíveis para sua conta.",
    en: "Automatically choose among the servers available to your account.",
  },
  random: {
    "pt-BR": "Servidor aleatório",
    en: "Random server",
  },
  free: {
    "pt-BR": "Servidores gratuitos",
    en: "Free servers",
  },
  all: {
    "pt-BR": "Todos os servidores",
    en: "All servers",
  },
  available: {
    "pt-BR": "Meu plano",
    en: "My plan",
  },
  secureCore: {
    "pt-BR": "Secure Core",
    en: "Secure Core",
  },
  search: {
    "pt-BR": "Buscar país, cidade ou servidor",
    en: "Search country, city or server",
  },
  empty: {
    "pt-BR": "Nenhum servidor encontrado.",
    en: "No servers found.",
  },
  maintenance: {
    "pt-BR": "Em manutenção",
    en: "Under maintenance",
  },
  paid: {
    "pt-BR": "Plano pago",
    en: "Paid plan",
  },
  load: {
    "pt-BR": "Ocupação",
    en: "Load",
  },
  more: {
    "pt-BR": "Mostrar mais",
    en: "Show more",
  },
  serverCount: {
    "pt-BR": "servidores",
    en: "servers",
  },
  refresh: {
    "pt-BR": "Atualizar lista",
    en: "Refresh list",
  },
  exitIp: {
    "pt-BR": "IP de saída do servidor",
    en: "Server exit IP",
  },
  recent: {
    "pt-BR": "Conexões recentes",
    en: "Recent connections",
  },
  autoConnect: {
    "pt-BR": "Conectar ao iniciar",
    en: "Connect on startup",
  },
  autoConnectHelp: {
    "pt-BR": "Retomar a VPN quando o navegador iniciar.",
    en: "Resume the VPN when the browser starts.",
  },
  preventWebrtcLeak: {
    "pt-BR": "Proteção WebRTC",
    en: "WebRTC protection",
  },
  preventWebrtcLeakHelp: {
    "pt-BR":
      "Obrigatória enquanto a VPN está ativa. Impede UDP WebRTC fora do proxy.",
    en: "Required while VPN is active. Prevents non-proxied WebRTC UDP.",
  },
  notification: {
    "pt-BR": "Notificações de conexão",
    en: "Connection notifications",
  },
  notificationHelp: {
    "pt-BR": "Receber avisos sobre o estado da VPN.",
    en: "Receive updates about the VPN connection.",
  },
  recents: {
    "pt-BR": "Guardar conexões recentes",
    en: "Save recent connections",
  },
  recentsHelp: {
    "pt-BR": "Manter atalhos para os últimos servidores usados.",
    en: "Keep shortcuts to recently used servers.",
  },
  secureCoreHelp: {
    "pt-BR": "Usar servidores Secure Core na conexão automática.",
    en: "Use Secure Core servers for automatic connections.",
  },
  managed: {
    "pt-BR": "Controlado pela configuração deste dispositivo.",
    en: "Controlled by this device configuration.",
  },
  split: {
    "pt-BR": "Tunelamento dividido",
    en: "Split tunneling",
  },
  splitHelp: {
    "pt-BR": "Escolha quais sites usam a VPN.",
    en: "Choose which sites use the VPN.",
  },
  enableSplit: {
    "pt-BR": "Ativar regras por site",
    en: "Enable website rules",
  },
  exclude: {
    "pt-BR": "Não usar VPN nestes sites",
    en: "Do not use VPN on these sites",
  },
  include: {
    "pt-BR": "Usar VPN somente nestes sites",
    en: "Use VPN only on these sites",
  },
  includeEmpty: {
    "pt-BR": "Adicione ao menos um domínio para usar este modo.",
    en: "Add at least one domain to use this mode.",
  },
  domain: {
    "pt-BR": "Domínio",
    en: "Domain",
  },
  add: {
    "pt-BR": "Adicionar",
    en: "Add",
  },
  subdomains: {
    "pt-BR": "Incluir subdomínios",
    en: "Include subdomains",
  },
  remove: {
    "pt-BR": "Remover",
    en: "Remove",
  },
  noDomains: {
    "pt-BR": "Nenhum domínio neste modo.",
    en: "No domains in this mode.",
  },
  save: {
    "pt-BR": "Salvar regras",
    en: "Save rules",
  },
  saved: {
    "pt-BR": "Regras salvas.",
    en: "Rules saved.",
  },
  unsaved: {
    "pt-BR": "Alterações ainda não salvas.",
    en: "Unsaved changes.",
  },
  invalidDomain: {
    "pt-BR": "Informe um domínio válido, sem caminhos, portas ou curingas.",
    en: "Enter a valid domain without paths, ports or wildcards.",
  },
  plan: {
    "pt-BR": "Plano",
    en: "Plan",
  },
  language: {
    "pt-BR": "Idioma",
    en: "Language",
  },
  signOut: {
    "pt-BR": "Sair da conta",
    en: "Sign out",
  },
  signOutHelp: {
    "pt-BR": "A conexão será encerrada. Você poderá entrar novamente depois.",
    en: "The connection will end. You can sign in again later.",
  },
  confirmSignOut: {
    "pt-BR": "Encerrar a conexão e sair da conta?",
    en: "Disconnect and sign out?",
  },
  keepAccount: {
    "pt-BR": "Continuar na conta",
    en: "Stay signed in",
  },
  help: {
    "pt-BR": "Ajuda da VPN",
    en: "VPN help",
  },
  manage: {
    "pt-BR": "Gerenciar conta Proton",
    en: "Manage Proton account",
  },
  confirmLeave: {
    "pt-BR": "Descartar as alterações nas regras?",
    en: "Discard changes to website rules?",
  },
  requestFailed: {
    "pt-BR": "Não foi possível concluir a ação. Tente novamente.",
    en: "Unable to complete the action. Try again.",
  },
  reloadLogin: {
    "pt-BR": "Atualizar após entrar",
    en: "Refresh after sign-in",
  },
  choose: {
    "pt-BR": "Escolher servidor",
    en: "Choose server",
  },
  rulesDisabled: {
    "pt-BR": "As regras serão aplicadas ao ativar esta opção.",
    en: "Rules will apply when this option is enabled.",
  },
};
