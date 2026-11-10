import { i18n } from '../lib/native/I18n'
import BrowserController from '../lib/browser/BrowserController'

const controller = new BrowserController
controller.onLoad()

globalThis.SuperPreferences.locale.watch(locale => {
  i18n.setLocales([locale])
  return i18n.load()
})
