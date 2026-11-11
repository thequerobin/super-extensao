<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
<section class="sync-overview">
  <UiHeading class="sync-section-title">
    <div>
      <h2>
        {{ t("UiProfiles") }}
        <span class="sync-count ui-count">{{ accounts.length }}</span>
      </h2>
      <p>{{ t("UiProfilesHelp") }}</p>
    </div>
    <UiButton
      v-if="accounts.length"
      class="sync-button ui-button"
      :disabled="busy || loading"
      @click="syncAll"
     type="submit">
      <SyncIcon small aria-hidden="true">mdi-sync</SyncIcon
      >{{ t("LabelSyncall") }}
    </UiButton>
  </UiHeading>
  <UiNotice
    v-if="error"
    role="alert"
    class="ui-notice sync-notice sync-error ui-notice-error"
  >
    {{ error }}
  </UiNotice>
  <div v-if="loading && !accounts.length" class="sync-empty" role="status">
    <SyncSpinner indeterminate size="24" />
    <p>{{ t("UiWorking") }}</p>
  </div>
  <template v-else-if="accounts.length">
    <UiField class="sync-search ui-focus-within ui-search"
      ><span class="ui-icon ui-icon-search" aria-hidden="true"></span
      ><span class="sr-only">{{ t("UiSearch") }}</span
      ><input v-model="query" type="search" :placeholder="t('UiSearch')"
    /></UiField>
    <div class="sync-profiles">
      <AccountCard
        v-for="account in filtered"
        :key="account.id"
        :account="account"
      />
    </div>
    <p v-if="!filtered.length" class="sync-empty">{{ t("UiNoMatches") }}</p>
    <router-link class="sync-add-profile" to="/new"
      ><SyncIcon small aria-hidden="true">mdi-plus</SyncIcon
      >{{ t("UiNew") }}</router-link
    >
  </template>
  <UiCard v-else class="sync-empty sync-welcome ui-card">
    <div class="sync-empty-icon">
      <SyncIcon large aria-hidden="true">mdi-bookmark-multiple-outline</SyncIcon>
    </div>
    <h2>{{ t("UiEmptyTitle") }}</h2>
    <p>{{ t("UiEmptyHelp") }}</p>
    <router-link
      class="sync-button sync-primary ui-button ui-button-primary"
      to="/new"
      >{{ t("UiCreate")
      }}<SyncIcon small aria-hidden="true">mdi-arrow-right</SyncIcon></router-link
    >
    <router-link to="/importexport">{{ t("LabelImport") }}</router-link>
  </UiCard>
</section>
</template>
<script>
import AccountCard from "../components/AccountCard";
import { actions } from "../store/definitions";
export default {
  name: "Overview",
  components: { AccountCard },
  data() {
    return { query: "", error: "", busy: false };
  },
  computed: {
    accounts() {
      return Object.values(this.$store.state.accounts).sort(
        (a, b) =>
          Number(Boolean(b.data.enabled)) - Number(Boolean(a.data.enabled))
      );
    },
    filtered() {
      const query = this.query.trim().toLocaleLowerCase();
      return this.accounts.filter((a) =>
        [a.data.label, a.label, a.fullPath, a.data.type]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query)
      );
    },
    loading() {
      return this.$store.state.loading.accounts;
    },
  },
  methods: {
    async syncAll() {
      this.busy = true;
      this.error = "";
      try {
        await this.$store.dispatch(actions.TRIGGER_SYNC_ALL);
      } catch (error) {
        this.error = error.message;
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
