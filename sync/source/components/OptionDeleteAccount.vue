<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <div>
    <div class="text-h6" role="heading" aria-level="3">
      {{ t("LabelRemoveaccount") }}
    </div>
    <div class="caption">
      {{ t("DescriptionRemoveaccount") }}
    </div>
    <v-btn small color="red accent-1" class="mt-3" @click="onClick">
      {{ t("LabelRemoveaccount") }}
    </v-btn>
  </div>
</template>

<script>
export default {
  name: "OptionDeleteAccount",
  methods: {
    onClick() {
      if (window.confirm(this.t("SuperRemoveConfirm"))) {
        this.$emit("click");
      }
    },
  },
};
</script>
