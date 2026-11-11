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
      <SyncCardBody id="server" class="text-h5" role="heading" aria-level="2">
        <SyncIcon aria-hidden="true"> mdi-account-box </SyncIcon>
        {{ t("LabelOptionsServerDetails") }}
      </SyncCardBody>
      <SyncCardBody>
        <SyncTextField
          outlined
          dense
          :value="url"
          :rules="[validateUrl]"
          :label="t('LabelKarakeepurl')"
          @input="$emit('update:url', $event)"
        />
        <SyncTextField
          outlined
          dense
          :label="t('LabelApiKey')"
          :type="showPassword ? 'text' : 'password'"
          @input="$emit('update:password', $event)"
        >
          <template #append>
            <SyncIcon
              role="button"
              tabindex="0"
              :aria-label="
                showPassword ? t('LabelHidepassword') : t('LabelShowpassword')
              "
              @click="showPassword = !showPassword"
              @keydown.enter="showPassword = !showPassword"
              @keydown.space.prevent="showPassword = !showPassword"
            >
              {{ showPassword ? "mdi-eye" : "mdi-eye-off" }}
            </SyncIcon>
          </template>
        </SyncTextField>
      </SyncCardBody>
    </SyncCard>

    <SyncCard v-if="isBrowser" class="mb-4">
      <SyncCardTitle id="folder" class="text-h5" role="heading" aria-level="2">
        <SyncIcon aria-hidden="true"> mdi-folder-outline </SyncIcon>
        {{ t("LabelOptionsFolderMapping") }}
      </SyncCardTitle>
      <SyncCardBody>
        <div class="text-h6" role="heading" aria-level="3">
          {{ t("LabelServerfolder") }}
        </div>
        <div class="caption">
          {{ t("DescriptionServerfolderkarakeep") }}
        </div>
        <SyncTextField
          outlined
          dense
          v-model="serverFolder"
          :label="t('LabelServerfolder')"
          @input="$emit('update:serverFolder', $event)"
        />
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
        <OptionClientCert
          v-if="isBrowser"
          :value="includeCredentials"
          @input="$emit('update:includeCredentials', $event)"
        />
        <OptionAllowRedirects
          :value="allowRedirects"
          @input="$emit('update:allowRedirects', $event)"
        />
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
import OptionClientCert from "./OptionClientCert";
import OptionAllowRedirects from "./OptionAllowRedirects";
import OptionDownloadLogs from "./OptionDownloadLogs";
import OptionAllowNetwork from "./native/OptionAllowNetwork";
import OptionExportBookmarks from "./OptionExportBookmarks.vue";
import OptionAutoSync from "./OptionAutoSync.vue";
import OptionSyncIntervalEnabled from "./OptionSyncIntervalEnabled.vue";
import OptionSyncOnStartup from "./OptionSyncOnStartup.vue";
import OptionNotifyOnly from "./OptionNotifyOnly.vue";

export default {
  name: "OptionsKarakeep",
  components: {
    OptionSyncOnStartup,
    OptionNotifyOnly,
    OptionSyncIntervalEnabled,
    OptionAutoSync,
    OptionExportBookmarks,
    OptionAllowNetwork,
    OptionDownloadLogs,
    OptionAllowRedirects,
    OptionClientCert,
    OptionFailsafe,
    OptionSyncFolder,
    OptionDeleteAccount,
    OptionSyncStrategy,
    OptionResetCache,
    OptionSyncInterval,
    OptionNestedSync,
  },
  props: [
    "url",
    "username",
    "password",
    "serverFolder",
    "includeCredentials",
    "serverRoot",
    "localRoot",
    "allowNetwork",
    "syncInterval",
    "strategy",
    "nestedSync",
    "failsafe",
    "allowRedirects",
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
      showPassword: false,
      showPassphrase: false,
    };
  },
  methods: {
    validateUrl(str) {
      try {
        const u = new URL(str);
        return Boolean(u) && u.protocol.startsWith("http");
      } catch (e) {
        return false;
      }
    },
  },
};
</script>
