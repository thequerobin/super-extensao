/* SPDX-License-Identifier: MPL-2.0 */
import Vue from "vue";
import { uiMessages } from "../messages";
export const translationState = Vue.observable({ version: 0 });
import { i18n } from "@sync-engine/native/I18n";

export function setupDirection(vuetify) {
  const rtl = i18n.isRTL();
  const framework = vuetify.framework || vuetify;
  framework.rtl = rtl;
  if (typeof document !== "undefined") {
    const root =
      document.getElementById("syncPanel") || document.documentElement;
    root.dir = rtl ? "rtl" : "ltr";
    root.lang = i18n.getLocale();
  }
}

export default {
  methods: {
    t(messageName, substitutions) {
      void translationState.version;
      return (
        uiMessages[messageName]?.[i18n.getLocale()] ||
        uiMessages[messageName]?.en ||
        i18n.getMessage(messageName, substitutions)
      );
    },
  },
};
