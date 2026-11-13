<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
<section class="sync-connections">
  <UiHeading class="sync-section-title">
    <div>
      <h2>{{ t("UiConnections") }}</h2>
      <p>{{ t("UiConnectionHelp") }}</p>
    </div>
  </UiHeading>
  <UiForm class="sync-form" @submit.prevent="save">
    <UiNotice class="ui-notice sync-notice">{{ t("SuperOAuthHelp") }}</UiNotice>
    <UiField
      >{{ t("SuperRedirect")
      }}<input
        :value="redirectUrl"
        readonly
        @focus="$event.target.select()"
        class="ui-control"
    /></UiField>
    <UiFieldset>
      <legend>Google Drive</legend>
      <UiField
        >{{ t("SuperGoogleId")
        }}<input
          v-model.trim="oauth.googleClientId"
          autocomplete="off"
          class="ui-control"
      /></UiField>
      <UiField
        >{{ t("SuperGoogleSecret")
        }}<input
          v-model.trim="oauth.googleClientSecret"
          type="password"
          autocomplete="new-password"
          class="ui-control"
      /></UiField>
    </UiFieldset>
    <UiFieldset>
      <legend>Dropbox</legend>
      <UiField
        >{{ t("SuperDropboxKey")
        }}<input
          v-model.trim="oauth.dropboxClientId"
          autocomplete="off"
          class="ui-control"
      /></UiField>
    </UiFieldset>
    <UiAsyncState :kind="error ? 'error' : loading ? 'loading' : ''" :text="error || t('UiWorking')" />
    <UiActions class="sync-save-row">
      <span role="status" class="ui-inline-status">{{
        saved ? t("UiSaved") : ""
      }}</span
      ><UiButton
        class="sync-button sync-primary ui-button ui-button-primary"
        :disabled="saving || loading"
       type="submit">
        {{ saving ? t("UiWorking") : t("SuperSave") }}
      </UiButton>
    </UiActions>
  </UiForm>
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
