<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <div>
    <div class="text-h6" role="heading" aria-level="3">
      {{ t("LabelFailsafe") }}
    </div>
    <div class="caption">
      {{ t("DescriptionFailsafe") }}
    </div>
    <SyncRadioGroup :value="value" @change="$emit('input', $event)">
      <SyncRadio :label="t('LabelFailsafeon')" :value="true" />
      <SyncRadio :label="t('LabelFailsafeoff')" :value="false" />
    </SyncRadioGroup>
  </div>
</template>

<script>
export default {
  name: "OptionFailsafe",
  props: {
    value: {
      type: Boolean,
      default: true,
    },
  },
};
</script>
