<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <div>
    <div class="text-h6" role="heading" aria-level="3">
      {{ t("LabelRemoveaccount") }}
    </div>
    <div class="caption">
      {{ t("DescriptionRemoveaccount") }}
    </div>
    <SyncButton small color="red accent-1" class="mt-3" @click="onClick">
      {{ t("LabelRemoveaccount") }}
    </SyncButton>
  </div>
</template>

<script>
import {confirmAction} from "../../../ui/confirmation.js";
export default {
  name: "OptionDeleteAccount",
  methods: {
    async onClick() {
      if (await confirmAction(document, this.t("SuperRemoveConfirm"))) {
        this.$emit("click");
      }
    },
  },
};
</script>
