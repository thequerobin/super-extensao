/* Shared explicit confirmation. Dismissal and page teardown always cancel. */
(function (root) {
  const active = new WeakMap();
  let sequence = 0;
  function confirmAction(doc, message, options = {}) {
    if (active.has(doc)) return Promise.resolve(false);
    const english = (options.locale || doc.documentElement.lang) === "en";
    const previous = doc.activeElement;
    const dialog = doc.createElement("dialog");
    dialog.className = "ui-confirmation";
    dialog.setAttribute("role", "alertdialog");
    const title = doc.createElement("h2"), text = doc.createElement("p"), actions = doc.createElement("div");
    title.id = `ui-confirmation-${++sequence}`;
    title.textContent = options.title || (english ? "Confirm action" : "Confirmar ação");
    dialog.setAttribute("aria-labelledby", title.id);
    text.id = `${title.id}-message`; text.textContent = message;
    dialog.setAttribute("aria-describedby", text.id);
    actions.className = "ui-actions";
    const cancel = doc.createElement("button"), confirm = doc.createElement("button");
    cancel.type = confirm.type = "button";
    cancel.className = "ui-button ui-button-secondary"; confirm.className = "ui-button ui-button-danger";
    cancel.textContent = options.cancelLabel || (english ? "Cancel" : "Cancelar");
    confirm.textContent = options.confirmLabel || (english ? "Confirm" : "Confirmar");
    cancel.dataset.confirm = "cancel"; confirm.dataset.confirm = "accept";
    if (options.cancelAction) cancel.dataset.action = options.cancelAction;
    if (options.confirmAction) confirm.dataset.action = options.confirmAction;
    actions.append(cancel, confirm); dialog.append(title, text, actions);
    return new Promise(resolve => {
      const settle = accepted => {
        if (active.get(doc) !== settle) return;
        active.delete(doc);
        doc.defaultView?.removeEventListener("pagehide", dismiss);
        doc.defaultView?.removeEventListener("unload", dismiss);
        dialog.remove();
        if (previous?.isConnected) previous.focus({preventScroll: true});
        resolve(accepted);
      };
      const dismiss = () => settle(false);
      active.set(doc, settle);
      cancel.addEventListener("click", dismiss);
      confirm.addEventListener("click", () => settle(true));
      dialog.addEventListener("cancel", event => {event.preventDefault(); dismiss();});
      dialog.addEventListener("close", dismiss);
      dialog.addEventListener("keydown", event => {
        if (event.key === "Escape") {event.preventDefault(); dismiss();}
        if (event.key === "Tab") {
          if (event.shiftKey && doc.activeElement === cancel) {event.preventDefault(); confirm.focus();}
          else if (!event.shiftKey && doc.activeElement === confirm) {event.preventDefault(); cancel.focus();}
        }
      });
      doc.defaultView?.addEventListener("pagehide", dismiss);
      doc.defaultView?.addEventListener("unload", dismiss);
      doc.body.append(dialog);
      try {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else {dialog.open = true; dialog.setAttribute("aria-modal", "true");}
      } catch {settle(false); return;}
      cancel.focus();
    });
  }
  function cancelConfirmation(doc) {active.get(doc)?.(false);}
  const api = {confirmAction, cancelConfirmation};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SuperConfirmation = api;
})(globalThis);
