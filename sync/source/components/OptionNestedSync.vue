<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <div>
    <div class="text-h6" role="heading" aria-level="3">
      {{ t("LabelNestedSync") }}
    </div>
    <div class="caption">
      {{ t("DescriptionNestedSync") }}
    </div>
    <SyncRadioGroup :value="value" @change="$emit('input', $event)">
      <SyncRadio :label="t('LabelNestedSyncNo')" :value="false" />
      <SyncRadio :label="t('LabelNestedSyncYes')" :value="true" />
    </SyncRadioGroup>
  </div>
</template>

<script>
export default {
  name: "OptionNestedSync",
  props: {
    value: {
      type: Boolean,
      default: false,
    },
  },
};
</script>
