<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <section class="sync-connections">
    <div class="sync-section-title">
      <div>
        <h2>{{ t("UiConnections") }}</h2>
        <p>{{ t("UiConnectionHelp") }}</p>
      </div>
    </div>
    <form class="sync-form" @submit.prevent="save">
      <p class="ui-notice sync-notice">{{ t("SuperOAuthHelp") }}</p>
      <label
        >{{ t("SuperRedirect")
        }}<input
          :value="redirectUrl"
          readonly
          @focus="$event.target.select()"
          class="ui-control"
      /></label>
      <fieldset>
        <legend>Google Drive</legend>
        <label
          >{{ t("SuperGoogleId")
          }}<input
            v-model.trim="oauth.googleClientId"
            autocomplete="off"
            class="ui-control"
        /></label>
        <label
          >{{ t("SuperGoogleSecret")
          }}<input
            v-model.trim="oauth.googleClientSecret"
            type="password"
            autocomplete="new-password"
            class="ui-control"
        /></label>
      </fieldset>
      <fieldset>
        <legend>Dropbox</legend>
        <label
          >{{ t("SuperDropboxKey")
          }}<input
            v-model.trim="oauth.dropboxClientId"
            autocomplete="off"
            class="ui-control"
        /></label>
      </fieldset>
      <p v-if="error" role="alert" class="sync-error ui-notice-error ui-notice">
        {{ error }}
      </p>
      <div class="sync-save-row">
        <span role="status" class="ui-inline-status">{{
          saved ? t("UiSaved") : ""
        }}</span
        ><button
          class="sync-button sync-primary ui-button ui-button-primary"
          :disabled="saving || loading"
        >
          {{ saving ? t("UiWorking") : t("SuperSave") }}
        </button>
      </div>
    </form>
  </section>
</template>
<script>
import browser from "@sync-engine/browser-api";
export default {
  name: "Connections",
  data() {
    return {
      oauth: {
        googleClientId: "",
        googleClientSecret: "",
        dropboxClientId: "",
      },
      redirectUrl: chrome.identity.getRedirectURL(),
      saved: false,
      saving: false,
      loading: true,
      error: "",
    };
  },
  watch: {
    oauth: {
      deep: true,
      handler() {
        this.saved = false;
      },
    },
  },
  async created() {
    try {
      const data = await browser.storage.local.get({ oauthClients: {} });
      this.oauth = { ...this.oauth, ...data.oauthClients };
    } catch (error) {
      this.error = error.message;
    } finally {
      this.loading = false;
    }
  },
  methods: {
    async save() {
      this.saving = true;
      this.error = "";
      try {
        await browser.storage.local.set({ oauthClients: { ...this.oauth } });
        this.saved = true;
      } catch (error) {
        this.error = error.message;
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
