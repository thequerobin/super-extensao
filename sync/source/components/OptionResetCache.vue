<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <div>
    <div class="text-h6" role="heading" aria-level="3">
      {{ t("LabelSyncfromscratch") }}
    </div>
    <div class="caption">
      {{ t("DescriptionResetcache") }}
    </div>
    <SyncButton small class="mt-3 mb-5" @click="$emit('click')">
      {{ t("LabelResetCache") }}
    </SyncButton>
  </div>
</template>

<script>
export default {
  name: "OptionResetCache",
};
</script>
