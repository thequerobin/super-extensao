<!-- SPDX-License-Identifier: MPL-2.0 -->
<template>
  <section class="sync-settings">
    <div class="sync-section-title">
      <div>
        <p class="sync-eyebrow">{{ data.type }}</p>
        <h2>{{ data.label || folderName || t("LabelOptions") }}</h2>
      </div>
      <router-link class="sync-button ui-button" to="/">{{
        t("LabelBack")
      }}</router-link>
    </div>
    <p
      v-if="error"
      role="alert"
      class="ui-notice sync-notice sync-error ui-notice-error"
    >
      {{ error }}
    </p>
    <p v-if="loading" role="status">{{ t("UiWorking") }}</p>
    <v-form v-if="!loading" class="mt-3 mb-3">
      <OptionsNextcloudFolders
        v-if="
          data.type === 'nextcloud-folders' ||
          data.type === 'nextcloud-bookmarks'
        "
        v-bind.sync="data"
        @reset="onReset"
        @delete="onDelete"
      />
      <OptionsLinkwarden
        v-if="data.type === 'linkwarden'"
        v-bind.sync="data"
        @reset="onReset"
        @delete="onDelete"
      />
      <OptionsKarakeep
        v-if="data.type === 'karakeep'"
        v-bind.sync="data"
        @reset="onReset"
        @delete="onDelete"
      />
      <OptionsWebdav
        v-if="data.type === 'webdav'"
        v-bind.sync="data"
        @reset="onReset"
        @delete="onDelete"
      />
      <OptionsS3
        v-if="data.type === 's3'"
        v-bind.sync="data"
        @reset="onReset"
        @delete="onDelete"
      />
      <OptionsGit
        v-if="data.type === 'git'"
        v-bind.sync="data"
        @reset="onReset"
        @delete="onDelete"
      />
      <OptionsFake
        v-if="data.type === 'fake'"
        v-bind.sync="data"
        @reset="onReset"
        @delete="onDelete"
      />
      <OptionsGoogleDrive
        v-if="data.type === 'google-drive'"
        v-bind.sync="data"
        @reset="onReset"
        @delete="onDelete"
      />
      <OptionsDropbox
        v-if="data.type === 'dropbox'"
        v-bind.sync="data"
        @reset="onReset"
        @delete="onDelete"
      />
    </v-form>
    <GoogleDriveComparison
      v-if="!loading && data.type === 'google-drive'"
      :profile="$store.state.accounts[id].data"
    />
    <div class="sync-save-row">
      <span role="status" class="ui-inline-status">{{
        saved ? t("UiSaved") : ""
      }}</span
      ><button
        class="sync-button sync-primary ui-button ui-button-primary"
        :disabled="loading || saving"
        @click="onSave"
      >
        {{ saving ? t("UiWorking") : t("LabelSave") }}
      </button>
    </div>
  </section>
</template>
<script>
import GoogleDriveComparison from "../components/GoogleDriveComparison.vue";
import PathHelper from "@sync-engine/PathHelper";
import BrowserTree from "@sync-engine/browser/BrowserTree";
import { actions } from "../store/definitions";
import OptionsNextcloudFolders from "../components/OptionsNextcloudBookmarks";
import OptionsLinkwarden from "../components/OptionsLinkwarden";
import OptionsKarakeep from "../components/OptionsKarakeep";
import OptionsWebdav from "../components/OptionsWebdav";
import OptionsS3 from "../components/OptionsS3.vue";
import OptionsFake from "../components/OptionsFake";
import OptionsGoogleDrive from "../components/OptionsGoogleDrive";
import OptionsDropbox from "../components/OptionsDropbox";
import OptionsGit from "../components/OptionsGit.vue";

export default {
  name: "AccountOptions",
  components: {
    GoogleDriveComparison,
    OptionsGit,
    OptionsGoogleDrive,
    OptionsDropbox,
    OptionsFake,
    OptionsWebdav,
    OptionsS3,
    OptionsNextcloudFolders,
    OptionsLinkwarden,
    OptionsKarakeep,
  },
  data() {
    return {
      folderName: "",
      data: {},
      savedData: false,
      error: "",
      saving: false,
      deleted: false,
    };
  },
  computed: {
    id() {
      return this.$route.params.accountId;
    },
    loading() {
      return (
        !this.$store.state.accounts[this.id] ||
        !this.$store.state.accounts[this.id].data ||
        !Object.keys(this.$store.state.accounts[this.id].data).length
      );
    },
    localRoot() {
      return this.data ? this.data.localRoot : null;
    },
    saved() {
      return this.savedData === JSON.stringify(this.data);
    },
    menuComponent() {
      return this.$vuetify.breakpoint.mobile ? "v-navigation-drawer" : "div";
    },
  },
  watch: {
    localRoot() {
      this.updateFolderName();
    },
    loading() {
      if (this.loading) return;
      this.data = JSON.parse(
        JSON.stringify(this.$store.state.accounts[this.id].data)
      );
    },
  },
  created() {
    this.updateFolderName();
    if (!this.loading) {
      this.data = JSON.parse(
        JSON.stringify(this.$store.state.accounts[this.id].data)
      );
    }
  },
  methods: {
    async onSave() {
      this.saving = true;
      this.error = "";
      try {
        await this.$store.dispatch(actions.STORE_ACCOUNT, {
          id: this.id,
          data: JSON.parse(JSON.stringify(this.data)),
        });
        this.savedData = JSON.stringify(this.data);
      } catch (error) {
        this.error = error.message || String(error);
      } finally {
        this.saving = false;
      }
    },
    async updateFolderName() {
      const pathArray = PathHelper.pathToArray(
        decodeURIComponent(await BrowserTree.getPathFromLocalId(this.localRoot))
      );
      this.folderName = pathArray[pathArray.length - 1];
    },
    async onDelete() {
      try {
        await this.$store.dispatch(actions.DELETE_ACCOUNT, this.id);
        this.$router.push("/");
      } catch (error) {
        this.error = error.message || String(error);
      }
    },
    async onReset() {
      try {
        await this.$store.dispatch(actions.RESET_ACCOUNT, this.id);
      } catch (error) {
        this.error = error.message || String(error);
      }
    },
  },
};
</script>
