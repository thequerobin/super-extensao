/* SPDX-License-Identifier: MPL-2.0 */
export const uiMessages = {
  SyncInvalidUrl: {
    "pt-BR":
      "Um favorito contém um endereço inválido. Confira os endereços antes de sincronizar.",
    en: "A bookmark contains an invalid URL. Check the addresses before syncing.",
  },
  SyncStorageFailed: {
    "pt-BR":
      "Não foi possível salvar o estado local. A sincronização foi interrompida para preservar a recuperação.",
    en: "The local state could not be saved. Synchronization was stopped to preserve recovery.",
  },
  SyncLocalWriteFailed: {
    "pt-BR":
      "Não foi possível alterar os favoritos locais. O plano foi preservado para uma nova tentativa.",
    en: "Local bookmarks could not be changed. The plan was preserved for another attempt.",
  },
  SyncManagedBookmarks: {
    "pt-BR":
      "A pasta contém favoritos gerenciados por política. Escolha uma pasta modificável para este perfil.",
    en: "The folder contains policy-managed bookmarks. Choose an editable folder for this profile.",
  },
  SyncRootLayoutChanged: {
    "pt-BR":
      "A estrutura das pastas fixas do navegador foi alterada no arquivo remoto. Restaure essas pastas antes de sincronizar.",
    en: "The remote file changed the browser’s permanent folder structure. Restore those folders before syncing.",
  },
  SyncProfilesLocked: {
    "pt-BR":
      "Os perfis foram bloqueados. Desbloqueie a sincronização para continuar.",
    en: "Profiles were locked. Unlock synchronization to continue.",
  },
  SyncLocalTreeChanged: {
    "pt-BR":
      "Os favoritos locais mudaram durante a sincronização. As alterações foram preservadas. Tente novamente.",
    en: "Local bookmarks changed during synchronization. Your changes were preserved. Try again.",
  },
  SyncFileTooLarge: {
    "pt-BR": "O arquivo ultrapassa o limite de 20 MB.",
    en: "The file exceeds the 20 MB limit.",
  },
  SyncUnsupportedXml: {
    "pt-BR":
      "O arquivo contém recursos XML não suportados. A sincronização foi interrompida.",
    en: "The file contains unsupported XML features. Synchronization was stopped.",
  },
  SyncInvalidFile: {
    "pt-BR":
      "O arquivo do Drive não contém favoritos XBEL válidos. Nenhum dado foi substituído.",
    en: "The Drive file does not contain valid XBEL bookmarks. No data was replaced.",
  },
  SyncTreeTooLarge: {
    "pt-BR": "A pasta ou o arquivo ultrapassa os limites deste motor.",
    en: "The folder or file exceeds this engine’s limits.",
  },
  SyncDuplicateIds: {
    "pt-BR":
      "O arquivo contém identificadores repetidos. Nenhum dado foi substituído.",
    en: "The file contains duplicate identifiers. No data was replaced.",
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
    "pt-BR": "Sincronização cancelada.",
    en: "Synchronization cancelled.",
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
      "Há mais de um arquivo com esse nome no Drive. Resolva os nomes duplicados antes de sincronizar.",
    en: "More than one Drive file has this name. Resolve the duplicate names before syncing.",
  },
  SyncRemoteFileChanged: {
    "pt-BR":
      "O arquivo no Drive mudou durante a sincronização. Tente novamente.",
    en: "The Drive file changed during synchronization. Try again.",
  },
  SyncUnsupportedProvider: {
    "pt-BR": "Este motor atende perfis de favoritos no Google Drive.",
    en: "This engine handles Google Drive bookmark profiles.",
  },
  SyncBookmarksOnly: {
    "pt-BR": "Escolha uma pasta de favoritos para sincronizar.",
    en: "Choose a bookmarks folder to synchronize.",
  },
  SyncProfileBusy: {
    "pt-BR": "Aguarde a sincronização deste perfil terminar.",
    en: "Wait for this profile’s synchronization to finish.",
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
  SyncInvalidIds: {
    "pt-BR":
      "Não foi possível identificar os favoritos com segurança. Nenhum dado foi substituído.",
    en: "Bookmarks could not be identified safely. No data was replaced.",
  },
  SyncFolderCycle: {
    "pt-BR":
      "As alterações criariam uma pasta dentro de si mesma. Confira a organização das pastas.",
    en: "The changes would create a folder cycle. Check your folder structure.",
  },
  SyncUnsupportedStrategy: {
    "pt-BR":
      "O modo de sincronização deste perfil não é suportado pelo novo motor.",
    en: "This profile’s synchronization mode is not supported by the new engine.",
  },
  SyncConflict: {
    "pt-BR":
      "O mesmo item foi alterado nos dois lados. Ajuste o conflito ou escolha Enviar/Receber uma vez nas ações avançadas.",
    en: "The same item changed on both sides. Resolve the conflict or choose Upload/Download once in the advanced actions.",
  },
  SyncOrderConflict: {
    "pt-BR":
      "A ordem dos favoritos mudou nos dois lados. Escolha a ordem desejada antes de sincronizar novamente.",
    en: "Bookmark order changed on both sides. Choose the desired order before syncing again.",
  },
  SyncDeletionGuard: {
    "pt-BR":
      "A proteção impediu uma exclusão grande ou de todos os itens. Confira os favoritos e o sentido da sincronização.",
    en: "Protection prevented a large deletion or deletion of all items. Check your bookmarks and synchronization direction.",
  },
  SyncWritePrecondition: {
    "pt-BR":
      "O Drive não forneceu uma revisão segura para gravar. A gravação sem proteção foi impedida.",
    en: "Drive did not provide a safe write revision. An unprotected upload was prevented.",
  },
  SyncCreateConflict: {
    "pt-BR":
      "O arquivo já foi criado por outra operação. Tente sincronizar novamente para verificar o resultado.",
    en: "The file was already created by another operation. Sync again to verify the result.",
  },
  SyncDecryptionFailed: {
    "pt-BR":
      "Não foi possível abrir o arquivo criptografado. Confira a senha do perfil.",
    en: "The encrypted file could not be opened. Check the profile password.",
  },
  SyncMigrationMappings: {
    "pt-BR":
      "Não foi possível aproveitar os mapeamentos anteriores. Confira seus favoritos antes de redefinir o cache para mesclar novamente.",
    en: "Previous mappings could not be reused. Check your bookmarks before resetting the cache to merge again.",
  },
  SyncRemoteLocked: {
    "pt-BR":
      "Outro dispositivo está sincronizando esse arquivo. Aguarde e tente novamente.",
    en: "Another device is syncing this file. Wait and try again.",
  },
  SyncUnsupportedState: {
    "pt-BR": "O estado salvo deste motor tem uma versão não suportada.",
    en: "The saved engine state has an unsupported version.",
  },
  SyncRemoteReplaced: {
    "pt-BR":
      "O arquivo original do perfil não foi encontrado ou foi substituído. Restaure o arquivo ou confira o perfil antes de redefinir o cache.",
    en: "The original profile file is missing or was replaced. Restore it or check the profile before resetting the cache.",
  },
  SyncProfileChanged: {
    "pt-BR":
      "O perfil mudou com uma operação pendente. Confira os dados antes de redefinir o cache.",
    en: "The profile changed while an operation was pending. Check your data before resetting the cache.",
  },
  SyncRecoveryConflict: {
    "pt-BR":
      "Houve alterações simultâneas durante uma recuperação. Os backups foram preservados. Confira os dados antes de redefinir o cache.",
    en: "Concurrent changes interrupted recovery. Backups were preserved. Check your data before resetting the cache.",
  },
  SyncRecoveryDirection: {
    "pt-BR":
      "Há uma sincronização pendente em outro sentido. Retome o sentido original ou confira os dados antes de redefinir o cache.",
    en: "A synchronization is pending in another direction. Resume the original direction or check your data before resetting the cache.",
  },
  SyncOverlappingProfiles: {
    "pt-BR":
      "Há perfis com pastas sobrepostas. Separe as pastas antes de usar o motor próprio nessa configuração.",
    en: "Profiles have overlapping folders. Separate their folders before using the own engine for this configuration.",
  },
};
