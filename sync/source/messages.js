/* SPDX-License-Identifier: MPL-2.0 */
export const uiMessages = {
  SyncLocalTreeChanged: {
    "pt-BR":
      "Os favoritos locais mudaram durante a leitura. Tente comparar novamente.",
    en: "Local bookmarks changed while being read. Compare again.",
  },
  UiCompareTitle: { "pt-BR": "Conferir favoritos", en: "Compare bookmarks" },
  UiCompareHelp: {
    "pt-BR":
      "Compara a pasta deste perfil com o arquivo salvo no Google Drive, usando a configuração salva. Não altera os favoritos.",
    en: "Compares this profile’s folder with its Google Drive file using the saved settings. Bookmarks are not changed.",
  },
  UiCompareDrive: {
    "pt-BR": "Comparar com Google Drive",
    en: "Compare with Google Drive",
  },
  UiCompareNoFile: {
    "pt-BR":
      "O arquivo deste perfil ainda não existe no Drive. Nenhum arquivo foi criado.",
    en: "This profile’s file does not exist in Drive yet. No file was created.",
  },
  UiCompareCommon: { "pt-BR": "Itens em comum", en: "Matching items" },
  UiCompareLocal: {
    "pt-BR": "Somente neste navegador",
    en: "Only in this browser",
  },
  UiCompareRemote: {
    "pt-BR": "Somente no Google Drive",
    en: "Only in Google Drive",
  },
  UiCompareInventory: {
    "pt-BR":
      "A contagem inclui favoritos e pastas, considerando nome, endereço e caminho. Não identifica mudanças de ordem nem decide o que será excluído.",
    en: "Counts include bookmarks and folders, considering title, URL and path. This comparison does not detect reordered items or decide deletions.",
  },
  SyncFileTooLarge: {
    "pt-BR": "O arquivo excede o limite de 20 MB para esta comparação.",
    en: "The file exceeds the 20 MB comparison limit.",
  },
  SyncUnsupportedXml: {
    "pt-BR":
      "Este arquivo contém recursos XBEL ainda não suportados pela comparação.",
    en: "This file contains XBEL features not yet supported by the comparison.",
  },
  SyncInvalidFile: {
    "pt-BR":
      "O arquivo não é um XBEL válido. Se estiver criptografado, esta comparação ainda não pode lê-lo.",
    en: "The file is not valid XBEL. Encrypted files are not supported by this comparison yet.",
  },
  SyncTreeTooLarge: {
    "pt-BR": "A pasta ou o arquivo ultrapassa os limites desta comparação.",
    en: "The folder or file exceeds the comparison limits.",
  },
  SyncDuplicateIds: {
    "pt-BR":
      "O arquivo contém identificadores repetidos. A comparação foi interrompida.",
    en: "The file contains duplicate identifiers. The comparison was stopped.",
  },
  SyncInvalidLocalTree: {
    "pt-BR": "Não foi possível interpretar a pasta local deste perfil.",
    en: "This profile’s local folder could not be read.",
  },
  SyncGoogleAuthorizationRequired: {
    "pt-BR":
      "Confira a configuração do Google em Conexões e a autorização deste perfil.",
    en: "Check the Google configuration in Connections and this profile’s authorization.",
  },
  SyncCancelled: {
    "pt-BR": "Comparação cancelada.",
    en: "Comparison cancelled.",
  },
  SyncGoogleRateLimited: {
    "pt-BR": "O Google limitou as requisições. Aguarde e tente novamente.",
    en: "Google limited the requests. Wait and try again.",
  },
  SyncGoogleRequestFailed: {
    "pt-BR": "Não foi possível consultar o Google Drive. Tente novamente.",
    en: "Google Drive could not be reached. Try again.",
  },
  SyncRequestTimedOut: {
    "pt-BR": "A consulta ao Google Drive demorou demais. Tente novamente.",
    en: "The Google Drive request timed out. Try again.",
  },
  SyncInvalidResponse: {
    "pt-BR": "O Google Drive retornou dados incompletos ou inesperados.",
    en: "Google Drive returned incomplete or unexpected data.",
  },
  SyncInvalidFileName: {
    "pt-BR": "Salve um nome de arquivo válido nas opções do perfil.",
    en: "Save a valid file name in this profile’s options.",
  },
  SyncAmbiguousDriveFile: {
    "pt-BR":
      "Há mais de um arquivo com esse nome no Drive. A comparação não escolheu nem removeu arquivos.",
    en: "More than one file has this name in Drive. No files were selected or removed.",
  },
  SyncRemoteFileChanged: {
    "pt-BR": "O arquivo mudou durante a leitura. Tente comparar novamente.",
    en: "The file changed while being read. Compare again.",
  },
  SyncUnsupportedProvider: {
    "pt-BR": "Esta comparação está disponível apenas para Google Drive.",
    en: "This comparison is available only for Google Drive.",
  },
  SyncBookmarksOnly: {
    "pt-BR":
      "Esta comparação precisa de uma pasta de favoritos. Perfis de abas ainda não são suportados.",
    en: "This comparison requires a bookmarks folder. Tab profiles are not supported yet.",
  },
  SyncEncryptedFileUnsupported: {
    "pt-BR":
      "A comparação ainda não suporta arquivos criptografados. Não desative sua criptografia para usá-la.",
    en: "This comparison does not support encrypted files yet. Keep your encryption enabled.",
  },
  SyncProfileBusy: {
    "pt-BR": "Aguarde a sincronização deste perfil terminar antes de comparar.",
    en: "Wait for this profile’s synchronization to finish before comparing.",
  },
  SyncLocalFolderMissing: {
    "pt-BR": "A pasta de favoritos deste perfil não foi encontrada.",
    en: "This profile’s bookmarks folder was not found.",
  },

  UiIntro: {
    "pt-BR": "Seus favoritos, em todos os navegadores.",
    en: "Your bookmarks, across browsers.",
  },
  UiProfiles: {
    "pt-BR": "Perfis",
    en: "Profiles",
  },
  UiNew: {
    "pt-BR": "Novo perfil",
    en: "New profile",
  },
  UiBackup: {
    "pt-BR": "Backup",
    en: "Backup",
  },
  UiConnections: {
    "pt-BR": "Conexões",
    en: "Connections",
  },
  UiProfilesHelp: {
    "pt-BR": "Escolha uma pasta e mantenha seus favoritos em dia.",
    en: "Choose a folder and keep your bookmarks up to date.",
  },
  UiEmptyTitle: {
    "pt-BR": "Leve seus favoritos com você",
    en: "Take your bookmarks with you",
  },
  UiEmptyHelp: {
    "pt-BR":
      "Conecte um serviço, escolha a pasta local e defina como sincronizar.",
    en: "Connect a service, choose a local folder and decide how to sync.",
  },
  UiCreate: {
    "pt-BR": "Criar primeiro perfil",
    en: "Create your first profile",
  },
  UiSearch: {
    "pt-BR": "Buscar perfil, serviço ou pasta",
    en: "Search profiles, services or folders",
  },
  UiNoMatches: {
    "pt-BR": "Nenhum perfil encontrado.",
    en: "No matching profiles.",
  },
  UiAdvanced: {
    "pt-BR": "Ações avançadas",
    en: "Advanced actions",
  },
  UiDirectionWarning: {
    "pt-BR":
      "Esta ação pode substituir favoritos no destino. Confira o sentido antes de continuar.",
    en: "This action can replace bookmarks at the destination. Check the direction before continuing.",
  },
  UiProvider: {
    "pt-BR": "Serviço",
    en: "Service",
  },
  UiName: {
    "pt-BR": "Nome",
    en: "Name",
  },
  UiAccess: {
    "pt-BR": "Conexão",
    en: "Connection",
  },
  UiFolder: {
    "pt-BR": "Pasta e regras",
    en: "Folder and rules",
  },
  UiDone: {
    "pt-BR": "Concluir",
    en: "Finish",
  },
  UiWizardHelp: {
    "pt-BR": "Onde você quer guardar seus favoritos?",
    en: "Where would you like to store your bookmarks?",
  },
  UiBackupHelp: {
    "pt-BR":
      "Transfira configurações entre instalações ou guarde uma cópia dos seus perfis.",
    en: "Transfer settings between installations or keep a copy of your profiles.",
  },
  UiBackupPrivacy: {
    "pt-BR":
      "O arquivo de perfis pode conter credenciais. Guarde-o em um local privado. Ele não é uma cópia dos favoritos.",
    en: "The profile file may contain credentials. Keep it private. It is not a backup of your bookmarks.",
  },
  UiConnectionHelp: {
    "pt-BR":
      "Configure os aplicativos de acesso ao Google Drive e Dropbox. Os demais serviços são configurados no próprio perfil.",
    en: "Configure access apps for Google Drive and Dropbox. Other services are configured in each profile.",
  },
  UiWorking: {
    "pt-BR": "Aguarde…",
    en: "Please wait…",
  },
  UiRetry: {
    "pt-BR": "Tentar novamente",
    en: "Try again",
  },
  UiSaved: {
    "pt-BR": "Alterações salvas.",
    en: "Changes saved.",
  },
  "UiServicenextcloud-bookmarks": {
    "pt-BR": "Seu servidor Nextcloud com o aplicativo Bookmarks.",
    en: "Your Nextcloud server with the Bookmarks app.",
  },
  UiServicelinkwarden: {
    "pt-BR": "Coleções de links no seu Linkwarden.",
    en: "Link collections in your Linkwarden.",
  },
  UiServicekarakeep: {
    "pt-BR": "Sua biblioteca de links no Karakeep.",
    en: "Your link library in Karakeep.",
  },
  UiServicewebdav: {
    "pt-BR": "Um arquivo no seu servidor ou nuvem WebDAV.",
    en: "A file on your WebDAV server or cloud.",
  },
  UiServices3: {
    "pt-BR": "Um bucket S3 ou serviço compatível.",
    en: "An S3 bucket or compatible service.",
  },
  UiServicegit: {
    "pt-BR": "Um arquivo em um repositório Git.",
    en: "A file in a Git repository.",
  },
  "UiServicegoogle-drive": {
    "pt-BR": "Um arquivo na sua conta Google Drive.",
    en: "A file in your Google Drive account.",
  },
  UiServicedropbox: {
    "pt-BR": "Um arquivo na sua conta Dropbox.",
    en: "A file in your Dropbox account.",
  },
};
