<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <div>
    <div class="text-h6" role="heading" aria-level="3">
      {{ t("LabelFiletype") }}
    </div>
    <div class="caption">
      {{ t("DescriptionFiletype") }}
    </div>
    <SyncRadioGroup :value="value" @change="$emit('input', $event)">
      <SyncRadio :label="t('LabelFiletypexbel')" value="xbel" />
      <SyncRadio :label="t('LabelFiletypehtml')" value="html" />
    </SyncRadioGroup>
  </div>
</template>

<script>
export default {
  name: "OptionFileType",
  props: {
    value: {
      type: String,
      default: "xbel",
    },
  },
};
</script>
