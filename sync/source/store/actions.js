/* SPDX-License-Identifier: MPL-2.0 */
// Compatibility boundary. Provider operations and data formats stay with the
// current engine; the interface owns loading state and awaits command failures.
import { actionsDefinition as engineActions } from "../../../vendor/floccus-source/src/ui/store/actions";
import Controller from "@sync-engine/Controller";
import { actions, mutations } from "./definitions";
export const actionsDefinition = {
  ...engineActions,
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
