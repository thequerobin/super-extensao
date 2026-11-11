<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <div>
    <SyncPanels v-model="panels" hover multiple>
      <SyncPanel>
        <SyncPanelHeader>{{
          t("LabelOptionsServerDetails")
        }}</SyncPanelHeader>
        <SyncPanelContent>
          <SyncTextField
            outlined
            dense
            :value="url"
            :rules="[validateUrl]"
            :label="t('LabelNextcloudurl')"
            @input="$emit('update:url', $event)"
          />
          <SyncTextField
            outlined
            dense
            :value="username"
            :label="t('LabelUsername')"
            @input="$emit('update:username', $event)"
          />
          <SyncTextField
            outlined
            dense
            :value="password"
            type="password"
            :label="t('LabelPassword')"
            @input="$emit('update:password', $event)"
          />
        </SyncPanelContent>
      </SyncPanel>

      <SyncPanel>
        <SyncPanelHeader>{{
          t("LabelOptionsFolderMapping")
        }}</SyncPanelHeader>
        <SyncPanelContent>
          <SyncContainer>
            <div class="heading">
              {{ t("LabelServerfolder") }}
            </div>
            <div class="caption">
              {{ t("DescriptionServerfolder") }}
            </div>
            <SyncTextField
              outlined
              dense
              :value="serverRoot"
              :placeholder="'/'"
              :rules="[validateServerRoot]"
              :label="t('LabelServerfolder')"
              @input="$emit('update:serverRoot', $event)"
            />
          </SyncContainer>
          <OptionSyncFolder
            :value="localRoot"
            @input="$emit('update:localRoot', $event)"
          />
          <OptionNestedSync
            :value="nestedSync"
            @input="$emit('update:nestedSync', $event)"
          />
        </SyncPanelContent>
      </SyncPanel>

      <SyncPanel>
        <SyncPanelHeader>{{
          t("LabelOptionsSyncBehavior")
        }}</SyncPanelHeader>
        <SyncPanelContent>
          <OptionSyncInterval
            :value="syncInterval"
            @input="$emit('update:syncInterval', $event)"
          />
          <OptionSyncStrategy
            :value="strategy"
            @input="$emit('update:strategy', $event)"
          />
        </SyncPanelContent>
      </SyncPanel>

      <SyncPanel>
        <SyncPanelHeader>{{
          t("LabelOptionsDangerous")
        }}</SyncPanelHeader>
        <SyncPanelContent>
          <OptionResetCache @click="$emit('reset')" />
          <OptionDeleteAccount @click="$emit('delete')" />
        </SyncPanelContent>
      </SyncPanel>
    </SyncPanels>
  </div>
</template>

<script>
import OptionSyncInterval from "./OptionSyncInterval";
import OptionResetCache from "./OptionResetCache";
import OptionSyncStrategy from "./OptionSyncStrategy";
import OptionDeleteAccount from "./OptionDeleteAccount";
import OptionSyncFolder from "./OptionSyncFolder";
import OptionNestedSync from "./OptionNestedSync";

export default {
  name: "OptionsNextcloudLegacy",
  components: {
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
    "serverRoot",
    "localRoot",
    "syncInterval",
    "strategy",
    "nestedSync",
  ],
  data() {
    return {
      panels: [0],
    };
  },
  methods: {
    validateUrl(str) {
      try {
        const u = new URL(str);
        return Boolean(u);
      } catch (e) {
        return false;
      }
    },
    validateServerRoot(path) {
      return (
        !path ||
        path !== "/" ||
        (path[0] === "/" && path[path.length - 1] !== "/")
      );
    },
  },
};
</script>
