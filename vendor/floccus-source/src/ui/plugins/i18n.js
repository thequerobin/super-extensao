import Vue from 'vue'
export const translationState = Vue.observable({version:0})
import { i18n } from '../../lib/native/I18n'

export function setupDirection(vuetify) {
  const rtl = i18n.isRTL()
  const framework = vuetify.framework || vuetify
  framework.rtl = rtl
  if (typeof document !== 'undefined') {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr'
    document.documentElement.lang = i18n.getLocale()
  }
}

export default {
  methods: {
    t(messageName, substitutions) {
      void translationState.version
      return i18n.getMessage(messageName, substitutions)
    },
  },
}
