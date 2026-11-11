/* SPDX-License-Identifier: MPL-2.0 */
// Compatibility boundary for profiles and commands. The worker routes Google
// Drive bookmark execution to the independent core; other providers stay legacy.
import { actionsDefinition as engineActions } from "../../../vendor/floccus-source/src/ui/store/actions";
import Controller from "@sync-engine/Controller";
import Logger from "@sync-engine/Logger";
import { downloadSyncLogs } from "../logs.cjs";
import { actions, mutations } from "./definitions";
export const actionsDefinition = {
  ...engineActions,
  async [actions.DOWNLOAD_LOGS](_context, anonymous) {
    return downloadSyncLogs({ logger: Logger, version: chrome.runtime.getManifest().version, anonymous });
  },
  async [actions.RESET_ACCOUNT](context, id) {
    const response = await chrome.runtime.sendMessage({
      channel: "super-sync",
      type: "resetOwnSync",
      params: [id],
    });
    if (response?.error) throw new Error(response.error);
    return engineActions[actions.RESET_ACCOUNT](context, id);
  },
  async [actions.DELETE_ACCOUNT](context, id) {
    const response = await chrome.runtime.sendMessage({
      channel: "super-sync",
      type: "assertOwnSyncIdle",
      params: [id],
    });
    if (response?.error) throw new Error(response.error);
    const result = await engineActions[actions.DELETE_ACCOUNT](context, id);
    await chrome.storage.local.remove(`superSync:engine[${id}]`);
    return result;
  },
  async [actions.LOAD_ACCOUNTS](context) {
    try {
      return await engineActions[actions.LOAD_ACCOUNTS](context);
    } finally {
      context.commit(mutations.LOADING_END, "accounts");
    }
  },
  async [actions.TRIGGER_SYNC](_context, id) {
    return (await Controller.getSingleton()).syncAccount(id);
  },
  async [actions.FORCE_SYNC](_context, id) {
    return (await Controller.getSingleton()).syncAccount(id, null, true);
  },
  async [actions.TRIGGER_SYNC_ALL]() {
    return (await Controller.getSingleton()).scheduleAll();
  },
};
