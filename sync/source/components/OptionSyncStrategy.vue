<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <div>
    <div class="text-h6" role="heading" aria-level="3">
      {{ t("LabelStrategy") }}
    </div>
    <div class="caption">
      {{ t("DescriptionStrategy") }}
    </div>
    <SyncRadioGroup :value="value" @change="$emit('input', $event)">
      <SyncRadio :label="t('LabelStrategydefault')" value="default" />
      <SyncRadio :label="t('LabelStrategyslave')" value="slave" />
      <SyncRadio :label="t('LabelStrategyoverwrite')" value="overwrite" />
    </SyncRadioGroup>
  </div>
</template>

<script>
export default {
  name: "OptionSyncStrategy",
  props: {
    value: {
      type: String,
      default: "default",
    },
  },
};
</script>
