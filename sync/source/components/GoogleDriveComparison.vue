<template>
  <section class="ui-card sync-comparison" :aria-busy="busy">
    <h2>{{ t("UiCompareTitle") }}</h2>
    <p class="sync-wizard-help">{{ t("UiCompareHelp") }}</p>
    <button
      class="ui-button"
      :disabled="busy || profile.syncing"
      @click="compare"
    >
      {{ busy ? t("UiWorking") : t("UiCompareDrive") }}
    </button>
    <p v-if="error" role="alert" class="ui-notice ui-notice-error sync-notice">
      {{ t(error) }}
    </p>
    <div v-if="result" role="status" class="sync-comparison-result">
      <p v-if="!result.remoteExists" class="ui-notice ui-notice-warning">
        {{ t("UiCompareNoFile") }}
      </p>
      <dl>
        <div>
          <dt>{{ t("UiCompareCommon") }}</dt>
          <dd>{{ result.common }}</dd>
        </div>
        <div>
          <dt>{{ t("UiCompareLocal") }}</dt>
          <dd>{{ result.localOnly }}</dd>
        </div>
        <div>
          <dt>{{ t("UiCompareRemote") }}</dt>
          <dd>{{ result.remoteOnly }}</dd>
        </div>
      </dl>
      <p class="sync-wizard-help">{{ t("UiCompareInventory") }}</p>
    </div>
  </section>
</template>
<script>
import { inspectGoogleDriveProfile } from "../../engine/index.cjs";
export default {
  name: "GoogleDriveComparison",
  props: { profile: { type: Object, required: true } },
  data: () => ({ busy: false, error: "", result: null, request: null }),
  watch: {
    profile: {
      deep: true,
      handler() {
        this.request?.abort();
        this.result = null;
        this.error = "";
      },
    },
  },
  beforeDestroy() {
    this.request?.abort();
  },
  methods: {
    async compare() {
      if (this.busy) return;
      const request = new AbortController();
      this.request = request;
      this.busy = true;
      this.error = "";
      this.result = null;
      try {
        const stored = await chrome.storage.local.get({
          "superSync:oauthClients": {},
        });
        const result = await inspectGoogleDriveProfile({
          profile: JSON.parse(JSON.stringify(this.profile)),
          oauth: stored["superSync:oauthClients"],
          bookmarks: chrome.bookmarks,
          signal: request.signal,
        });
        if (!request.signal.aborted) this.result = result;
      } catch (error) {
        if (!request.signal.aborted)
          this.error = error.code || "SyncGoogleRequestFailed";
      } finally {
        if (this.request === request) {
          this.busy = false;
          this.request = null;
        }
      }
    },
  },
};
</script>
