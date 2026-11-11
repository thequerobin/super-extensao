<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <div>
    <SyncTextField
      outlined
      dense
      :value="username"
      :label="t('LabelUsername')"
      :loading="isRunning"
      :error-messages="error"
      @input="$emit('update:username', $event)"
    >
      <template slot="append-outer">
        <SyncTooltip v-if="!isRunning" left>
          <template #activator="{ on }">
            <SyncButton
              icon
              :aria-label="t('LabelLoginFlowStart')"
              @click="onFlowStart"
              v-on="on"
            >
              <SyncIcon aria-hidden="true"> mdi-account-circle </SyncIcon>
            </SyncButton>
          </template>
          <span>{{ t("LabelLoginFlowStart") }}</span>
        </SyncTooltip>
        <SyncTooltip v-else left>
          <template #activator="{ on }">
            <SyncButton
              icon
              :aria-label="t('LabelLoginFlowStop')"
              @click="onFlowStop"
              v-on="on"
            >
              <SyncIcon aria-hidden="true"> mdi-cancel </SyncIcon>
            </SyncButton>
          </template>
          <span>{{ t("LabelLoginFlowStop") }}</span>
        </SyncTooltip>
      </template>
    </SyncTextField>
    <SyncTextField
      outlined
      dense
      :type="showPassword ? 'text' : 'password'"
      :label="t('LabelPassword')"
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
  </div>
</template>

<script>
import { actions } from "../store/definitions";

export default {
  name: "NextcloudLogin",
  props: {
    password: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    server: {
      type: String,
      required: true,
    },
  },
  data() {
    return { error: null, showPassword: false };
  },
  computed: {
    isRunning() {
      return this.$store.state.loginFlow.isRunning;
    },
  },
  methods: {
    async onFlowStart() {
      this.error = null;
      try {
        const credentials = await this.$store.dispatch(
          actions.START_LOGIN_FLOW,
          this.server
        );
        this.$emit("update:username", credentials.username);
        this.$emit("update:password", credentials.password);
      } catch (e) {
        this.error = e.message;
      }
    },
    async onFlowStop() {
      await this.$store.dispatch("STOP_LOGIN_FLOW");
    },
  },
};
</script>
