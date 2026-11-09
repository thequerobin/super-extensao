import { i18n } from '../lib/native/I18n'
import BrowserController from '../lib/browser/BrowserController'

const controller = new BrowserController
controller.onLoad()

async function loadLocale() { const d=await chrome.storage.sync.get({'tabliss/config/locale':'pt-BR'});i18n.setLocales([d['tabliss/config/locale']]);await i18n.load() }
loadLocale()
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='sync'&&changes['tabliss/config/locale'])loadLocale()})
