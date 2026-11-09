import Vue from 'vue'
import vuetify from './plugins/vuetify'
import capacitor from './plugins/capacitor'
import App from './App'
import { router } from './router'
import store from './store'
import i18nPlugin, { setupDirection } from './plugins/i18n'
import {i18n} from '../lib/native/I18n'
import '@mdi/font/css/materialdesignicons.css'

Vue.mixin(i18nPlugin)
Vue.mixin(capacitor)

const app = async () => {
  const data=await chrome.storage.sync.get({'tabliss/config/locale':'pt-BR'})
  i18n.setLocales([data['tabliss/config/locale']])
  i18n.load().then(() => {
    setupDirection(vuetify)
    window['floccus'] = global['Floccus'] = new Vue({
      el: '#app',
      router,
      store,
      vuetify,
      render: (h) => h(App),
    })
  })
}

export default app
