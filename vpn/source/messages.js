/* SPDX-License-Identifier: GPL-3.0-only */
export const messages = {
  VpnProxyControlledElsewhere: {
    "pt-BR": "Outra extensão ou uma política do navegador controla o proxy.",
    en: "Another extension or a browser policy controls the proxy.",
  },
  VpnProxyNotApplied: {
    "pt-BR": "O navegador não confirmou a configuração da VPN. Tente conectar novamente.",
    en: "The browser did not confirm the VPN configuration. Try connecting again.",
  },
  VpnProxyClearFailed: {
    "pt-BR": "Não foi possível confirmar a remoção do proxy. Tente desconectar novamente.",
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
    "pt-BR": "O endereço ou a porta do servidor é inválido. Atualize a lista de servidores.",
    en: "The server address or port is invalid. Refresh the server list.",
  },
  VpnWebRTCProtectionUnavailable: {
    "pt-BR": "Não foi possível ativar a proteção WebRTC. Verifique as permissões do navegador.",
    en: "Could not enable WebRTC protection. Check browser permissions.",
  },
  VpnWebRTCSettingsFailed: {
    "pt-BR": "O navegador não conseguiu atualizar a proteção WebRTC.",
    en: "The browser could not update WebRTC protection.",
  },
  VpnSessionStorageFailed: {
    "pt-BR": "Não foi possível salvar ou ler a sessão da VPN neste dispositivo.",
    en: "Could not save or read the VPN session on this device.",
  },
  VpnInvalidSessionResponse: {
    "pt-BR": "O serviço retornou uma sessão inválida. Entre na conta novamente.",
    en: "The service returned an invalid session. Sign in again.",
  },
  VpnSessionUnavailable: {
    "pt-BR": "Entre na conta Proton para conectar.",
    en: "Sign in to your Proton account to connect.",
  },
  VpnSignInSuperseded: {
    "pt-BR": "Este pedido de login foi cancelado por outra ação. Inicie o login novamente.",
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
    "pt-BR": "Reduzir a exposição do IP por WebRTC durante a conexão.",
    en: "Reduce IP exposure through WebRTC while connected.",
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
