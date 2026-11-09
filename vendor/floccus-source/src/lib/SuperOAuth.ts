import browser from './browser-api'
import {i18n} from './native/I18n'
export async function getOAuthConfig(provider: 'google' | 'dropbox') {
  const {oauthClients} = await browser.storage.local.get({oauthClients:{}})
  const client_id = provider === 'google' ? oauthClients.googleClientId : oauthClients.dropboxClientId
  if (!client_id) throw new Error(i18n.getMessage('SuperOAuthMissing'))
  return {client_id,client_secret: provider === 'google' ? oauthClients.googleClientSecret || '' : ''}
}
