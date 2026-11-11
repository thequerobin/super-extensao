<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <SyncContainer>
    <div>
      <SyncTextField
        outlined
        dense
        append-icon="mdi-label"
        class="mt-2 mb-4"
        :value="label"
        :label="t('LabelAccountlabel')"
        :hint="t('DescriptionAccountlabel')"
        :persistent-hint="true"
        @input="$emit('update:label', $event)"
      />
    </div>
    <SyncCard class="mb-4">
      <SyncCardTitle id="server" class="text-h5" role="heading" aria-level="2">
        <SyncIcon aria-hidden="true"> mdi-account-box </SyncIcon>
        {{ t("LabelOptionsServerDetails") }}
      </SyncCardTitle>
      <SyncCardBody>
        <div>
          <template v-if="authorized || refreshToken">
            {{ username }}
            <SyncIcon color="success"> mdi-check </SyncIcon>
          </template>
          <SyncButton color="primary" @click="authenticate">
            {{ t("LabelLogingoogle") }}
          </SyncButton>
          <p class="mt-1">
            {{
              authorized || refreshToken
                ? t("DescriptionLoggedingoogle")
                : t("DescriptionLogingoogle")
            }}
          </p>
        </div>
        <SyncTextField
          outlined
          dense
          append-icon="mdi-file-document"
          class="mt-2"
          :value="bookmark_file"
          :rules="[validateBookmarksFile]"
          :label="t('LabelBookmarksfile')"
          :hint="t('DescriptionBookmarksfilegoogle')"
          :persistent-hint="true"
          @input="$emit('update:bookmark_file', $event)"
        />
        <OptionPassphrase
          :value="password"
          @input="$emit('update:password', $event)"
        />
      </SyncCardBody>
    </SyncCard>

    <SyncCard v-if="isBrowser" class="mb-4">
      <SyncCardTitle id="folder" class="text-h5" role="heading" aria-level="2">
        <SyncIcon aria-hidden="true"> mdi-folder-outline </SyncIcon>
        {{ t("LabelOptionsFolderMapping") }}
      </SyncCardTitle>
      <SyncCardBody>
        <OptionSyncFolder
          :value="localRoot"
          @input="$emit('update:localRoot', $event)"
        />
      </SyncCardBody>
    </SyncCard>

    <SyncCard v-if="!isBrowser" class="mb-4">
      <SyncCardTitle id="mobile" class="text-h5" role="heading" aria-level="2">
        <SyncIcon aria-hidden="true"> mdi-cellphone-settings </SyncIcon>
        {{ t("LabelMobilesettings") }}
      </SyncCardTitle>
      <SyncCardBody>
        <OptionAllowNetwork
          :value="allowNetwork"
          @input="$emit('update:allowNetwork', $event)"
        />
        <OptionExportBookmarks />
      </SyncCardBody>
    </SyncCard>

    <SyncCard class="mb-4">
      <SyncCardTitle id="sync" class="text-h5" role="heading" aria-level="2">
        <SyncIcon aria-hidden="true"> mdi-sync-circle </SyncIcon>
        {{ t("LabelOptionsSyncBehavior") }}
      </SyncCardTitle>
      <SyncCardBody>
        <OptionAutoSync
          :value="enabled"
          @input="$emit('update:enabled', $event)"
        />
        <OptionSyncOnStartup
          :value="syncOnStartupEnabled"
          @input="$emit('update:syncOnStartupEnabled', $event)"
        />
        <template v-if="isBrowser">
          <OptionSyncIntervalEnabled
            :value="syncIntervalEnabled"
            @input="$emit('update:syncIntervalEnabled', $event)"
          />
          <OptionSyncInterval
            v-if="syncIntervalEnabled"
            :value="syncInterval"
            @input="$emit('update:syncInterval', $event)"
          />
          <OptionNotifyOnly
            :notify-only="notifyOnly"
            :notifications-enabled="notificationsEnabled"
            @update:notifyOnly="$emit('update:notifyOnly', $event)"
            @update:notificationsEnabled="
              $emit('update:notificationsEnabled', $event)
            "
          />
        </template>
        <OptionSyncStrategy
          :value="strategy"
          @input="$emit('update:strategy', $event)"
        />
        <OptionNestedSync
          v-if="isBrowser"
          :value="nestedSync"
          @input="$emit('update:nestedSync', $event)"
        />
      </SyncCardBody>
    </SyncCard>

    <SyncCard class="mb-4">
      <SyncCardTitle id="danger" class="text-h5" role="heading" aria-level="2">
        <SyncIcon aria-hidden="true"> mdi-alert-circle </SyncIcon>
        {{ t("LabelOptionsDangerous") }}
      </SyncCardTitle>
      <SyncCardBody>
        <OptionDownloadLogs />
        <OptionResetCache @click="$emit('reset')" />
        <OptionFailsafe
          :value="failsafe"
          @input="$emit('update:failsafe', $event)"
        />
        <OptionDeleteAccount @click="$emit('delete')" />
      </SyncCardBody>
    </SyncCard>
  </SyncContainer>
</template>

<script>
import OptionSyncInterval from "./OptionSyncInterval";
import OptionResetCache from "./OptionResetCache";
import OptionSyncStrategy from "./OptionSyncStrategy";
import OptionDeleteAccount from "./OptionDeleteAccount";
import OptionSyncFolder from "./OptionSyncFolder";
import OptionNestedSync from "./OptionNestedSync";
import OptionFailsafe from "./OptionFailsafe";
import OptionDownloadLogs from "./OptionDownloadLogs";
import OptionAllowNetwork from "./native/OptionAllowNetwork";
import OptionPassphrase from "./OptionPassphrase";
import OptionExportBookmarks from "./OptionExportBookmarks.vue";
import OptionAutoSync from "./OptionAutoSync.vue";
import OptionSyncIntervalEnabled from "./OptionSyncIntervalEnabled.vue";
import OptionSyncOnStartup from "./OptionSyncOnStartup.vue";
import OptionNotifyOnly from "./OptionNotifyOnly.vue";

export default {
  name: "OptionsGoogleDrive",
  components: {
    OptionSyncOnStartup,
    OptionNotifyOnly,
    OptionSyncIntervalEnabled,
    OptionAutoSync,
    OptionExportBookmarks,
    OptionPassphrase,
    OptionAllowNetwork,
    OptionDownloadLogs,
    OptionFailsafe,
    OptionSyncFolder,
    OptionDeleteAccount,
    OptionSyncStrategy,
    OptionResetCache,
    OptionSyncInterval,
    OptionNestedSync,
  },
  props: [
    "username",
    "password",
    "refreshToken",
    "localRoot",
    "allowNetwork",
    "syncInterval",
    "strategy",
    "bookmark_file",
    "nestedSync",
    "failsafe",
    "enabled",
    "label",
    "syncIntervalEnabled",
    "syncOnStartupEnabled",
    "notifyOnly",
    "notificationsEnabled",
  ],
  data() {
    return {
      panels: [0, 1],
      authorized: false,
      showPassphrase: false,
    };
  },
  methods: {
    validateBookmarksFile(path) {
      return !path.includes("/");
    },
    async authenticate() {
      const GoogleDriveAdapter = (
        await import("@sync-engine/adapters/GoogleDrive")
      ).default;
      const { refresh_token, username } = await GoogleDriveAdapter.authorize();
      if (refresh_token) {
        this.authorized = true;
        this.$emit("update:refreshToken", refresh_token);
        this.$emit("update:username", username);
      }
    },
  },
};
</script>
