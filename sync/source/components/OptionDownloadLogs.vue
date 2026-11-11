<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <div>
    <div class="text-h6" role="heading" aria-level="3">
      {{ t("LabelDownloadlogs") }}
    </div>
    <div class="caption">
      {{ t("DescriptionDownloadlogs") }}
    </div>
    <SyncRow>
      <SyncCol>
        <SyncButton small class="mb-5" @click="onGetLogs(true)">
          {{ t("LabelDownloadanonymizedlogs") }}
        </SyncButton>
      </SyncCol>
      <SyncCol>
        <SyncButton small class="mb-5" @click="onGetLogs(false)">
          {{ t("LabelDownloadfulllogs") }}
        </SyncButton>
      </SyncCol>
    </SyncRow>
  </div>
</template>

<script>
export default {
  name: "OptionDownloadLogs",
  methods: {
    onGetLogs(anonymous) {
      this.$store.dispatch("DOWNLOAD_LOGS", anonymous);
    },
  },
};
</script>
