<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <section class="sync-overview">
    <div class="sync-section-title">
      <div>
        <h2>
          {{ t("UiProfiles") }}
          <span class="sync-count">{{ accounts.length }}</span>
        </h2>
        <p>{{ t("UiProfilesHelp") }}</p>
      </div>
      <button
        v-if="accounts.length"
        class="sync-button"
        :disabled="busy || loading"
        @click="syncAll"
      >
        <v-icon small aria-hidden="true">mdi-sync</v-icon
        >{{ t("LabelSyncall") }}
      </button>
    </div>
    <p v-if="error" role="alert" class="sync-notice sync-error">{{ error }}</p>
    <div v-if="loading && !accounts.length" class="sync-empty" role="status">
      <v-progress-circular indeterminate size="24" />
      <p>{{ t("UiWorking") }}</p>
    </div>
    <template v-else-if="accounts.length">
      <label class="sync-search"
        ><v-icon small aria-hidden="true">mdi-magnify</v-icon
        ><span class="sr-only">{{ t("UiSearch") }}</span
        ><input v-model="query" type="search" :placeholder="t('UiSearch')"
      /></label>
      <div class="sync-profiles">
        <AccountCard
          v-for="account in filtered"
          :key="account.id"
          :account="account"
        />
      </div>
      <p v-if="!filtered.length" class="sync-empty">{{ t("UiNoMatches") }}</p>
      <router-link class="sync-add-profile" to="/new"
        ><v-icon small aria-hidden="true">mdi-plus</v-icon
        >{{ t("UiNew") }}</router-link
      >
    </template>
    <div v-else class="sync-empty sync-welcome">
      <div class="sync-empty-icon">
        <v-icon large aria-hidden="true">mdi-bookmark-multiple-outline</v-icon>
      </div>
      <h2>{{ t("UiEmptyTitle") }}</h2>
      <p>{{ t("UiEmptyHelp") }}</p>
      <router-link class="sync-button sync-primary" to="/new"
        >{{ t("UiCreate")
        }}<v-icon small aria-hidden="true">mdi-arrow-right</v-icon></router-link
      >
      <router-link to="/importexport">{{ t("LabelImport") }}</router-link>
    </div>
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
