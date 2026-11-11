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
          :label="t('LabelS3endpoint')"
          :hint="t('DescriptionS3endpoint')"
          :persistent-hint="true"
          @input="$emit('update:url', $event)"
        />
        <SyncTextField
          outlined
          dense
          :value="region"
          class="mt-2"
          :label="t('LabelS3region')"
          :hint="t('DescriptionS3region')"
          :persistent-hint="true"
          @input="$emit('update:region', $event)"
        />
        <SyncTextField
          outlined
          dense
          :value="bucket"
          class="mt-2"
          :rules="[validateBucket]"
          :label="t('LabelS3bucket')"
          @input="$emit('update:bucket', $event)"
        />
        <SyncSwitch
          :input-value="pathStyle"
          :label="t('LabelS3pathstyle')"
          :hint="t('DescriptionS3pathstyle')"
          :persistent-hint="true"
          dense
          class="mt-0 pt-0 mb-4"
          @change="$emit('update:pathStyle', $event)"
        />
        <SyncTextField
          outlined
          dense
          :value="username"
          :label="t('LabelS3accesskey')"
          @input="$emit('update:username', $event)"
        />
        <SyncTextField
          outlined
          dense
          :label="t('LabelS3secretkey')"
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
        <SyncTextField
          outlined
          dense
          append-icon="mdi-file-document"
          :value="bookmark_file"
          :rules="[validateBookmarksFile]"
          :label="t('LabelBookmarksfile')"
          :hint="t('DescriptionBookmarksfiles3')"
          :persistent-hint="true"
          @input="$emit('update:bookmark_file', $event)"
        />
        <OptionPassphrase
          :value="passphrase"
          @input="$emit('update:passphrase', $event)"
        />
        <OptionFileType
          :value="bookmark_file_type"
          @input="$emit('update:bookmark_file_type', $event)"
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
import OptionFileType from "./OptionFileType";
import OptionExportBookmarks from "./OptionExportBookmarks.vue";
import OptionPassphrase from "./OptionPassphrase.vue";
import OptionAutoSync from "./OptionAutoSync.vue";
import OptionSyncIntervalEnabled from "./OptionSyncIntervalEnabled.vue";
import OptionSyncOnStartup from "./OptionSyncOnStartup.vue";
import OptionNotifyOnly from "./OptionNotifyOnly.vue";

export default {
  name: "OptionsS3",
  components: {
    OptionSyncOnStartup,
    OptionNotifyOnly,
    OptionSyncIntervalEnabled,
    OptionAutoSync,
    OptionExportBookmarks,
    OptionAllowNetwork,
    OptionDownloadLogs,
    OptionFailsafe,
    OptionSyncFolder,
    OptionDeleteAccount,
    OptionSyncStrategy,
    OptionResetCache,
    OptionSyncInterval,
    OptionNestedSync,
    OptionFileType,
    OptionPassphrase,
  },
  props: [
    "url",
    "region",
    "bucket",
    "pathStyle",
    "username",
    "password",
    "passphrase",
    "serverRoot",
    "localRoot",
    "allowNetwork",
    "syncInterval",
    "strategy",
    "bookmark_file",
    "nestedSync",
    "failsafe",
    "bookmark_file_type",
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
    validateBucket(name) {
      return Boolean(name) && !name.includes("/");
    },
    validateBookmarksFile(path) {
      return path[0] !== "/" && path[path.length - 1] !== "/";
    },
  },
};
</script>
