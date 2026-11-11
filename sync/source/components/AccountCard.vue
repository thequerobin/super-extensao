<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <article
    class="sync-profile"
    :data-state="status"
    :aria-busy="Boolean(account.data.syncing)"
  >
    <div class="sync-profile-top">
      <span class="sync-provider">{{ account.data.type }}</span
      ><span class="sync-status" role="status"
        ><v-icon
          small
          :class="{ spinning: account.data.syncing }"
          aria-hidden="true"
          >{{ statusIcon }}</v-icon
        >{{ statusLabel }}</span
      >
    </div>
    <h3>{{ account.data.label || folderName }}</h3>
    <p class="sync-folder">
      <v-icon small aria-hidden="true">{{
        localRoot === "tabs" ? "mdi-tab" : "mdi-folder-outline"
      }}</v-icon
      >{{ rootPath || folderName }}
    </p>
    <p class="sync-destination">{{ uri }}</p>
    <v-progress-linear
      v-if="account.data.syncing"
      :value="Number(account.data.syncing) * 100"
      :indeterminate="typeof account.data.syncing !== 'number'"
    />
    <p
      class="sync-profile-detail"
      :class="{ 'sync-error': account.data.error }"
    >
      {{ statusDetail }}
    </p>
    <p v-if="legacyWarning" class="sync-notice">{{ legacyWarning }}</p>
    <p v-if="!account.data.failsafe" class="sync-notice">
      {{ t("StatusFailsafeoff") }}
    </p>
    <p v-if="actionError" class="sync-error" role="alert">{{ actionError }}</p>
    <div class="sync-profile-actions">
      <router-link
        class="sync-button"
        :to="{
          name: routes.ACCOUNT_OPTIONS,
          params: { accountId: account.id },
        }"
        ><v-icon small aria-hidden="true">mdi-cog-outline</v-icon
        >{{ t("LabelOptions") }}</router-link
      >
      <button
        v-if="account.data.syncing"
        class="sync-button"
        :disabled="busy"
        @click="onCancelSync"
      >
        {{ t("LabelCancelsync") }}
      </button>
      <router-link
        v-else-if="needsAuthorization"
        class="sync-button sync-primary"
        :to="{
          name: routes.ACCOUNT_OPTIONS,
          params: { accountId: account.id },
        }"
        >{{ t("LabelAuthorize") }}</router-link
      >
      <button
        v-else
        class="sync-button sync-primary"
        :disabled="busy || Boolean(account.data.scheduled)"
        @click="onTriggerSync"
      >
        <v-icon small aria-hidden="true">mdi-sync</v-icon
        >{{ t("LabelSyncnow") }}
      </button>
    </div>
    <details class="sync-advanced">
      <summary>{{ t("UiAdvanced") }}</summary>
      <div>
        <button
          class="sync-button"
          :disabled="
            busy || Boolean(account.data.syncing || account.data.scheduled)
          "
          @click="confirmDirection = 'down'"
        >
          {{ t("LabelSyncDownOnce") }}
        </button>
        <button
          class="sync-button"
          :disabled="
            busy || Boolean(account.data.syncing || account.data.scheduled)
          "
          @click="confirmDirection = 'up'"
        >
          {{ t("LabelSyncUpOnce") }}
        </button>
        <button
          v-if="status === 'scheduled'"
          class="sync-button"
          :disabled="busy"
          @click="onForceSync"
        >
          {{ t("LabelScheduledforcesync") }}
        </button>
        <button class="sync-button" :disabled="busy" @click="onGetLogs">
          {{ t("LabelDebuglogs") }}
        </button>
      </div>
    </details>
    <v-dialog
      :value="Boolean(confirmDirection)"
      max-width="460"
      @input="!$event && (confirmDirection = '')"
      ><v-card class="sync-confirm"
        ><v-card-title>{{
          t(confirmDirection === "up" ? "LabelSyncUpOnce" : "LabelSyncDownOnce")
        }}</v-card-title
        ><v-card-text
          ><p>{{ t("UiDirectionWarning") }}</p>
          <p>
            {{
              t(
                confirmDirection === "up"
                  ? "DescriptionSyncUp"
                  : "DescriptionSyncDown"
              )
            }}
          </p></v-card-text
        ><v-card-actions
          ><v-btn text @click="confirmDirection = ''">{{
            t("LabelCancel")
          }}</v-btn
          ><v-btn class="primary" @click="runDirection">{{
            t("LabelContinue")
          }}</v-btn></v-card-actions
        ></v-card
      ></v-dialog
    >
  </article>
</template>
<script>
import PathHelper from "@sync-engine/PathHelper";
import humanizeDuration from "humanize-duration";
import { actions } from "../store/definitions";
import { routes } from "../router";
import BrowserTree from "@sync-engine/browser/BrowserTree";
import { needsAuthorization } from "@sync-engine/AccountAuthorization";

export default {
  name: "AccountCard",
  props: {
    account: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      rootPath: "",
      actionError: "",
      busy: false,
      confirmDirection: "",
      statusColors: {
        disabled: "rgb(125, 114, 128)",
        ok: "#3d8e39",
        error: "#8e3939",
        authorize: "#8e6739",
        syncing: "#2196F3",
        scheduled: "#2196F3",
        pending: "#d32f2f",
      },
      statusIcons: {
        disabled: "mdi-sync-off",
        ok: "mdi-check",
        error: "mdi-sync-alert",
        authorize: "mdi-login-variant",
        syncing: "mdi-sync",
        scheduled: "mdi-timer-sync-outline",
        pending: "mdi-alert-circle-outline",
      },
      statusLabels: {
        disabled: this.t("StatusDisabled"),
        ok: this.t("StatusAllgood"),
        error: this.t("StatusError"),
        authorize: this.t("StatusAuthorizationneeded"),
        syncing: this.t("StatusSyncing"),
        scheduled: this.t("StatusScheduled"),
        pending: this.t("StatusNeedssync"),
      },
      strategyIcons: {
        slave: "mdi-arrow-down-bold",
        overwrite: "mdi-arrow-up-bold",
        default: "mdi-merge",
      },
      strategyLabels: {
        slave: this.t("LabelSyncDown"),
        overwrite: this.t("LabelSyncUp"),
        default: this.t("LabelSyncNormal"),
      },
      strategyDescriptions: {
        slave: this.t("DescriptionSyncDown"),
        overwrite: this.t("DescriptionSyncUp"),
        default: this.t("DescriptionSyncNormal"),
      },
      showDetails: false,
    };
  },
  computed: {
    folderName() {
      const pathArray = PathHelper.pathToArray(
        this.rootPath || this.t("LabelRootfolder")
      );
      return pathArray[pathArray.length - 1] || this.t("LabelUntitledfolder");
    },
    localRoot() {
      return this.account.data.localRoot;
    },
    uri() {
      return this.account.label;
    },
    needsAuthorization() {
      return needsAuthorization(this.account.data);
    },
    status() {
      if (this.account.data.syncing) {
        return "syncing";
      }
      if (this.account.data.scheduled) {
        return "scheduled";
      }
      if (this.needsAuthorization) {
        return "authorize";
      }
      if (this.account.data.error) {
        return "error";
      }
      if (this.account.data.pendingChanges) {
        return "pending";
      }
      if (
        !this.account.data.enabled &&
        !this.account.data.syncIntervalEnabled &&
        !this.account.data.syncOnStartupEnabled
      ) {
        return "disabled";
      }
      return "ok";
    },
    statusIcon() {
      return this.statusIcons[this.status];
    },
    statusColor() {
      return this.statusColors[this.status];
    },
    statusLabel() {
      return this.t(
        {
          disabled: "StatusDisabled",
          ok: "StatusAllgood",
          error: "StatusError",
          authorize: "StatusAuthorizationneeded",
          syncing: "StatusSyncing",
          scheduled: "StatusScheduled",
          pending: "StatusNeedssync",
        }[this.status]
      );
    },
    statusType() {
      if (this.needsAuthorization) {
        return "warning";
      }
      if (this.account.data.error) {
        return "error";
      }
      if (this.status === "pending") {
        return "warning";
      }
      return "info";
    },
    statusDetail() {
      if (this.needsAuthorization) {
        return this.t("DescriptionAuthorizationneeded");
      }
      if (this.account.data.error) {
        return (
          this.account.data.error +
          " | " +
          this.t("StatusLastsynced", [
            humanizeDuration(Date.now() - this.account.data.lastSync, {
              largest: 1,
              round: true,
              language: navigator.language.split("-")[0],
              fallbacks: navigator.languages
                .map((lang) => lang.split("-")[0])
                .concat(["en"]),
            }),
          ])
        );
      }
      if (this.account.data.syncing) {
        return this.t("DescriptionSyncinprogress");
      }
      if (this.account.data.scheduled) {
        return this.t("DescriptionSyncscheduled");
      }
      if (this.status === "pending") {
        const pending = this.account.data.pendingChanges;
        return pending.initial
          ? this.t("DescriptionPendingInitialSync")
          : this.t("DescriptionPendingChanges", [
              String(pending.local),
              String(pending.server),
            ]);
      }
      if (this.account.data.lastSync) {
        return this.t("StatusLastsynced", [
          humanizeDuration(Date.now() - this.account.data.lastSync, {
            largest: 1,
            round: true,
            language: navigator.language.split("-")[0],
            fallbacks: navigator.languages
              .map((lang) => lang.split("-")[0])
              .concat(["en"]),
          }),
        ]);
      }
      return this.t("StatusNeversynced");
    },
    legacyWarning() {
      if (
        this.account.data.type === "nextcloud" ||
        this.account.data.type === "nextcloud-legacy"
      ) {
        return this.t("LegacyAdapterDeprecation");
      }
      return null;
    },
    routes() {
      return routes;
    },
  },
  watch: {
    async localRoot(localRoot) {
      this.rootPath = await BrowserTree.getPathFromLocalId(localRoot);
    },
  },
  async created() {
    this.rootPath = await BrowserTree.getPathFromLocalId(this.localRoot);
  },
  methods: {
    onChangeStrategy() {
      this.$store.dispatch(actions.STORE_ACCOUNT, {
        id: this.account.id,
        data: this.account.data,
      });
    },
    async perform(action, payload = this.account.id) {
      this.busy = true;
      this.actionError = "";
      try {
        await this.$store.dispatch(action, payload);
      } catch (error) {
        this.actionError = error.message || String(error);
      } finally {
        this.busy = false;
      }
    },
    onTriggerSync() {
      return this.perform(actions.TRIGGER_SYNC);
    },
    onCancelSync() {
      return this.perform(actions.CANCEL_SYNC);
    },
    runDirection() {
      const action =
        this.confirmDirection === "up"
          ? actions.TRIGGER_SYNC_UP
          : actions.TRIGGER_SYNC_DOWN;
      this.confirmDirection = "";
      return this.perform(action);
    },
    onToggleEnabled() {
      this.$store.dispatch(actions.STORE_ACCOUNT, {
        id: this.account.id,
        data: this.account.data,
      });
    },
    onGetLogs() {
      this.perform(actions.DOWNLOAD_LOGS, false);
    },
    onForceSync() {
      if (confirm(this.t("DescriptionScheduledforcesync"))) {
        this.perform(actions.FORCE_SYNC);
      }
    },
  },
};
</script>
