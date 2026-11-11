<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <v-app id="app" class="sync-workspace">
    <header class="sync-heading">
      <div>
        <p class="sync-eyebrow">{{ t("SuperSyncTitle") }}</p>
        <h1>{{ t("UiIntro") }}</h1>
      </div>
      <label v-if="!embedded" class="sync-language"
        ><span class="sr-only">{{ t("SuperLanguage") }}</span
        ><select
          v-model="locale"
          :aria-label="t('SuperLanguage')"
          @change="changeLocale"
        >
          <option value="pt-BR">PT-BR</option>
          <option value="en">EN</option>
        </select></label
      >
    </header>
    <nav class="sync-navigation" :aria-label="t('SuperSyncTitle')">
      <router-link
        v-for="item in navigation"
        :key="item.path"
        :to="item.path"
        :exact="item.path === '/'"
        :aria-current="active(item.path) ? 'page' : null"
        ><v-icon small aria-hidden="true">{{ item.icon }}</v-icon
        >{{ t(item.label) }}</router-link
      >
    </nav>
    <p v-if="loadError" role="alert" class="sync-notice sync-error">
      {{ loadError }}
      <button class="sync-button" @click="load">{{ t("UiRetry") }}</button>
    </p>
    <v-main v-if="initialized && !locked && !loadError"
      ><router-view :key="$route.path"
    /></v-main>
    <section v-if="initialized && locked" class="sync-unlock">
      <v-icon large aria-hidden="true">mdi-lock-outline</v-icon>
      <h2>{{ t("LabelUnlock") }}</h2>
      <form @submit.prevent="onUnlock">
        <label
          >{{ t("LabelKey")
          }}<input
            v-model="key"
            type="password"
            autocomplete="current-password"
            required
        /></label>
        <p v-if="unlockError" role="alert" class="sync-error">
          {{ unlockError }}
        </p>
        <button class="sync-button sync-primary" :disabled="unlocking">
          {{ unlocking ? t("UiWorking") : t("LabelUnlock") }}
        </button>
      </form>
    </section>
  </v-app>
</template>
<script>
import { actions } from "./store/definitions";
import Controller from "@sync-engine/Controller";
import { i18n } from "@sync-engine/native/I18n";
import { translationState, setupDirection } from "./plugins/i18n";
export default {
  name: "SuperSync",
  data() {
    return {
      locale: i18n.getLocale(),
      embedded:Boolean(document.getElementById("language")),
      key: "",
      unlockError: "",
      loadError: "",
      initialized: false,
      unlocking: false,
      navigation: [
        {
          path: "/",
          label: "UiProfiles",
          icon: "mdi-bookmark-multiple-outline",
        },
        { path: "/new", label: "UiNew", icon: "mdi-plus" },
        { path: "/importexport", label: "UiBackup", icon: "mdi-tray-arrow-up" },
        {
          path: "/connections",
          label: "UiConnections",
          icon: "mdi-link-variant",
        },
      ],
    };
  },
  computed: {
    locked() {
      return this.$store.state.locked;
    },
  },
  async created() {
    const preferences = globalThis.SuperPreferences;
    const stopTheme = preferences.watchTheme((_theme, resolved) => {
      this.$vuetify.theme.dark = resolved === "dark";
      const root =
        document.getElementById("syncPanel") || document.documentElement;
      root.dataset.superTheme = resolved;
    });
    const stopLocale = preferences.locale.watch(async (locale) => {
      this.locale = locale;
      if (locale === i18n.getLocale()) return;
      i18n.setLocales([locale]);
      await i18n.load();
      translationState.version++;
      setupDirection(this.$vuetify);
    });
    let unregister = () => {};
    const cleanup = () => {
      stopTheme();
      stopLocale();
      unregister();
    };
    this.$once("hook:beforeDestroy", cleanup);
    window.addEventListener("unload", cleanup, { once: true });
    await this.load();
    try {
      const controller = await Controller.getSingleton();
      unregister = controller.onStatusChange(() => {
        if (!this.locked) this.loadAccounts();
      });
    } catch (error) {
      this.loadError = error.message;
    }
  },
  methods: {
    active(path) {
      return path === "/"
        ? this.$route.path === "/" || this.$route.path.startsWith("/options/")
        : this.$route.path === path;
    },
    async changeLocale() {
      await globalThis.SuperPreferences.locale.set(this.locale);
    },
    async loadAccounts() {
      try {
        await this.$store.dispatch(actions.LOAD_ACCOUNTS);
        this.loadError = "";
      } catch (error) {
        this.loadError = error.message || String(error);
      }
    },
    async load() {
      this.loadError = "";
      try {
        await this.$store.dispatch(actions.LOAD_LOCKED);
        if (!this.locked) await this.loadAccounts();
      } catch (error) {
        this.loadError = error.message || String(error);
      } finally {
        this.initialized = true;
      }
    },
    async onUnlock() {
      this.unlocking = true;
      this.unlockError = "";
      try {
        await this.$store.dispatch(actions.UNLOCK, this.key);
        this.key = "";
        await this.loadAccounts();
      } catch (error) {
        this.unlockError = error.message;
        this.key = "";
      } finally {
        this.unlocking = false;
      }
    },
  },
};
</script>
