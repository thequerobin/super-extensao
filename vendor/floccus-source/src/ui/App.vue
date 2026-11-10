<template>
  <v-app
    id="app"
    :style="appStyle">
    <header class="super-sync-header">
      <img src="/icons/icon48.png" alt="" width="40" height="40">
      <div><strong>Super Extensão</strong><h1>{{ t('SuperSyncTitle') }}</h1></div>
      <router-link v-if="$route.path !== '/'" to="/" class="super-back">{{ t('LabelHome') }}</router-link>
      <label>{{ t('SuperLanguage') }}<select v-model="locale" @change="changeLocale"><option value="pt-BR">Português do Brasil</option><option value="en">English</option></select></label>
    </header>
    <details class="super-oauth">
      <summary>{{ t('SuperOAuthTitle') }}</summary>
      <p>{{ t('SuperOAuthHelp') }}</p>
      <label>{{ t('SuperRedirect') }}<input :value="redirectUrl" readonly></label>
      <label>{{ t('SuperGoogleId') }}<input v-model.trim="oauth.googleClientId" autocomplete="off"></label>
      <label>{{ t('SuperGoogleSecret') }}<input v-model.trim="oauth.googleClientSecret" type="password" autocomplete="new-password"></label>
      <label>{{ t('SuperDropboxKey') }}<input v-model.trim="oauth.dropboxClientId" autocomplete="off"></label>
      <v-btn class="primary" @click="saveOAuth">{{ t('SuperSave') }}</v-btn>
      <span role="status">{{ savedMessage }}</span>
    </details>
    <v-main>
      <router-view />
    </v-main>
    <v-dialog
      v-model="locked"
      :max-width="600"
      persistent>
      <v-card>
        <v-card-title>
          <v-icon aria-hidden="true">
            mdi-lock-outline
          </v-icon>{{ t('LabelUnlock') }}
        </v-card-title>
        <v-card-text>
          <v-alert
            v-if="unlockError"
            outlined
            dense
            :icon="false"
            type="warning">
            {{ unlockError }}
          </v-alert>
          <v-text-field
            v-model="key"
            :label="t('LabelKey')"
            type="password"
            @keyup.enter="onUnlock" />
          <div class="d-flex flex-row-reverse">
            <v-btn
              class="primary"
              @click="onUnlock">
              {{ t('LabelUnlock') }}
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script>
import { version as VERSION } from '../../package.json'
import { actions } from './store/definitions'
import { routes } from './router'
import Controller from '../lib/Controller'
import browser from '../lib/browser-api'
import { i18n } from '../lib/native/I18n'
import { translationState, setupDirection } from './plugins/i18n'
export default {
  name: 'App',
  data() {
    return {
      VERSION,
      locale:i18n.getLocale(),
      oauth:{googleClientId:'',googleClientSecret:'',dropboxClientId:''},
      savedMessage:'',
      redirectUrl:chrome.identity.getRedirectURL(),
      key: '',
      unlockError: null,
    }
  },
  computed: {
    locked() {
      return this.$store.state.locked
    },
    routes() {
      return routes
    },
    appStyle() {
      return {
        background: this.$vuetify.theme.dark ? '#11151d' : '#f5f7fb',
      }
    },
  },
  async created() {
    const preferences = globalThis.SuperPreferences
    const stopTheme = preferences.watchTheme((_theme, resolved) => {
      this.$vuetify.theme.dark = resolved === 'dark'
      const root = document.getElementById('syncPanel') || document.documentElement
      root.dataset.superTheme = resolved
    })
    const stopLocale = preferences.locale.watch(async locale => {
      this.locale = locale
      if (locale === i18n.getLocale()) return
      i18n.setLocales([locale])
      await i18n.load()
      translationState.version++
      setupDirection(this.$vuetify)
    })
    this.$once('hook:beforeDestroy', () => {
      stopTheme()
      stopLocale()
    })
    const current = await browser.storage.local.get({oauthClients:{}})
    this.oauth = {...this.oauth,...current.oauthClients}

    if (window.KAGI) {
      browser.storage.local.set({ isOrion: true })
    }

    await Promise.all([
      this.$store.dispatch(actions.LOAD_LOCKED),
      this.$store.dispatch(actions.LOAD_ACCOUNTS),
    ])
    const controller = await Controller.getSingleton()
    const unregister = controller.onStatusChange(() =>
      this.$store.dispatch(actions.LOAD_ACCOUNTS)
    )
    window.addEventListener('beforeunload', unregister)
    window.addEventListener('beforeunload', unregister)
    window.addEventListener('unload', unregister)
    window.addEventListener('close', unregister)
  },
  methods: {
    async changeLocale() {
      await globalThis.SuperPreferences.locale.set(this.locale)
    },
    async saveOAuth() {
      await browser.storage.local.set({oauthClients:{...this.oauth}})
      this.savedMessage=this.t('SuperSaved')
    },

    async onUnlock() {
      try {
        await this.$store.dispatch(actions.UNLOCK, this.key)
      } catch (e) {
        this.unlockError = e.message
        this.key = ''
      }
    },
    openInNewTab() {
      browser.tabs.create({ url: window.location.href })
    },
  },
}
</script>

<style>
[dir="rtl"] .v-application {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Arabic", "Cairo", Roboto, Tahoma, sans-serif !important;
}

[dir="rtl"] .v-icon.mdi-arrow-left {
  transform: scaleX(-1);
}

/*
 * Extension popups are sized to their content, so the body needs a min-width
 * or the popup collapses. Apply it by default and only lift it on small touch
 * screens (mobile browsers open the popup as a full-width page): some desktop
 * browsers (e.g. Samsung Internet on Windows) don't match device-width queries
 * in popups, so the min-width must not depend on one matching.
 */
body {
  min-width: 420px;
}

@media screen and (pointer: coarse) and (max-device-width: 419px) {
  body {
    min-width: 0;
  }
}
</style>
