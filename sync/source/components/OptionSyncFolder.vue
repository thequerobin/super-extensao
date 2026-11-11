<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <div>
    <div>
      <div class="text-h6" role="heading" aria-level="3">
        {{ t("LabelLocaltarget") }}
      </div>
      <div class="caption">
        {{ t("DescriptionLocaltarget") }}
      </div>
      <SyncRadioGroup v-model="mode" column>
        <SyncRadio value="folder">
          <template #label>
            {{ t("LabelLocalfolder") }}
            <SyncTextField
              outlined
              dense
              v-model="path"
              class="ms-2"
              readonly
              :aria-label="t('LabelLocalfolder')"
              @click="onTriggerFinder"
            >
              <template #append>
                <SyncIcon
                  color="blue darken-1"
                  aria-hidden="true"
                  @click="onTriggerFinder"
                >
                  mdi-folder
                </SyncIcon>
              </template>
            </SyncTextField>
          </template>
        </SyncRadio>
        <div class="caption ms-8 mb-6">
          {{ t("DescriptionLocalfolder") }}
        </div>
        <SyncRadio :label="t('LabelSyncTabs')" value="tabs" />
        <div class="caption ms-8 mb-2">
          {{ t("DescriptionSyncTabs") }}
        </div>
      </SyncRadioGroup>
    </div>
    <SyncDialog v-model="finder" max-width="600" :style="{ height: '500px' }">
      <SyncCard>
        <SyncRow no-gutters>
          <SyncCol class="flex-grow-1">
            <SyncCardTitle class="headline">
              {{ t("LabelLocalfolder") }}
            </SyncCardTitle>
          </SyncCol>
          <SyncCol class="flex-grow-0">
            <SyncButton class="primary ma-2" @click="onSave">
              {{ t("LabelSave") }}
            </SyncButton>
          </SyncCol>
        </SyncRow>
        <SyncTree
          v-if="folders.length"
          class="pa-4"
          activatable
          :item-text="'title'"
          :item-key="'id'"
          :active="[value]"
          :open="folders.length ? [folders[0].id] : []"
          :items="folders"
          dense
          @update:active="onUpdateSelection"
        >
          <template #prepend="{ open }">
            <SyncIcon aria-hidden="true">
              {{ open ? "mdi-folder-open" : "mdi-folder" }}
            </SyncIcon>
          </template>
          <template #label="{ item }">
            {{ item.title || t("LabelUntitledfolder") }}
          </template>
        </SyncTree>
        <SyncSpinner
          v-else
          color="primary"
          indeterminate
          class="ma-8"
        />
      </SyncCard>
    </SyncDialog>
  </div>
</template>

<script>
import { isVivaldi } from "@sync-engine/browser/BrowserDetection";

export default {
  name: "OptionSyncFolder",
  props: { value: { type: String, default: undefined } },
  data() {
    return {
      selectedLocalRoot: this.value,
      path: "",
      mode: "folder",
      finder: false,
      folders: [],
    };
  },
  watch: {
    value(localRoot) {
      this.selectedLocalRoot = this.value;
      this.updatePath();
    },
    mode() {
      if (this.mode === "tabs") {
        this.$emit("input", "tabs");
      }
      if (this.mode === "folder" && this.value === "tabs") {
        this.$emit("input", "");
      }
    },
  },
  created() {
    this.updatePath();
  },
  methods: {
    async updatePath() {
      if (this.mode === "tabs" || this.value === "tabs") {
        this.mode = "tabs";
        return;
      }
      const BrowserTree = (await import("@sync-engine/browser/BrowserTree"))
        .default;
      if (this.value) {
        this.path =
          decodeURIComponent(await BrowserTree.getPathFromLocalId(this.value)) +
          "/";
      } else {
        this.path = this.t("LabelSelectfolder");
      }
    },
    async onTriggerFinder() {
      const browser = (await import("@sync-engine/browser-api")).default;
      this.selectedLocalRoot = this.value;
      this.finder = true;
      this.folders = this.filterOutBookmarks(
        (await isVivaldi())
          ? await browser.bookmarks.getSubTree("1")
          : await browser.bookmarks.getTree()
      );
    },
    filterOutBookmarks(children) {
      return children.filter((item) => {
        if (item.children) {
          item.children = this.filterOutBookmarks(item.children);
        }
        return !item.url;
      });
    },
    onUpdateSelection(active) {
      this.selectedLocalRoot = active[0];
    },
    onSave() {
      this.finder = false;
      this.$emit("input", this.selectedLocalRoot);
    },
  },
};
</script>
