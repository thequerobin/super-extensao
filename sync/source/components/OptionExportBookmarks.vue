<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <div>
    <div class="text-h6" role="heading" aria-level="3">
      {{ t("LabelExportBookmarks") }}
    </div>
    <div class="caption">
      {{ t("DescriptionExportBookmarks") }}
    </div>
    <SyncButton class="mb-5" @click="onExport()">
      {{ t("LabelExportBookmarks") }}
    </SyncButton>
  </div>
</template>

<script>
export default {
  name: "OptionExportBookmarks",
  methods: {
    onExport() {
      this.$store.dispatch("EXPORT_BOOKMARKS", this.$route.params.accountId);
    },
  },
};
</script>
