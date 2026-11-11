/* SPDX-License-Identifier: MPL-2.0 */
import Vue from "vue";
import vuetify from "./plugins/vuetify";
import capacitor from "./plugins/capacitor";
import App from "./App";
import { router } from "./router";
import store from "./store";
import i18nPlugin, { setupDirection } from "./plugins/i18n";
import { i18n } from "@sync-engine/native/I18n";
import "@mdi/font/css/materialdesignicons.css";
import { installUi } from "../../ui/vue";
import { installEngineUi } from "./components/ui/engine";
import "../../ui/vue.css";

Vue.use(installUi);
Vue.use(installEngineUi);

Vue.mixin(i18nPlugin);
Vue.mixin(capacitor);

const app = async () => {
  const mount =
    document.getElementById("syncApp") || document.getElementById("app");
  if (!mount) return;
  i18n.setLocales([await globalThis.SuperPreferences.locale.get()]);
  i18n.load().then(() => {
    setupDirection(vuetify);
    window.superSyncApp = new Vue({
      el: mount,
      router,
      store,
      vuetify,
      render: (h) => h(App),
    });
  });
};

app();

export default app;
