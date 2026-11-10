"use strict";
(() => {
  const MIN = 360, MAX = 600, DEFAULT = 580;
  const grip = document.getElementById("popupResize");
  let height = DEFAULT;
  let drag = null;
  let changed = false;
  function apply(value) {
    height = Math.max(MIN, Math.min(MAX, Math.round(value)));
    document.documentElement.style.setProperty("--popup-height", `${height}px`);
    grip.setAttribute("aria-valuenow", String(height));
    grip.setAttribute("aria-valuetext", `${height} pixels`);
  }
  function save() {
    chrome.storage.local.set({popupHeight:height}).catch(console.error);
  }
  chrome.storage.local.get({popupHeight:DEFAULT}).then(settings => {
    if (!changed) apply(Number.isFinite(settings.popupHeight) ? settings.popupHeight : DEFAULT);
  }).catch(console.error);
  grip.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    event.preventDefault();
    changed = true;
    drag = {id:event.pointerId, y:event.screenY, height};
    grip.setPointerCapture(event.pointerId);
    document.body.classList.add("resizing");
  });
  grip.addEventListener("pointermove", event => {
    if (drag?.id === event.pointerId) apply(drag.height + event.screenY - drag.y);
  });
  function finish(event) {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    document.body.classList.remove("resizing");
    if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
    save();
  }
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) grip.addEventListener(name, finish);
  grip.addEventListener("keydown", event => {
    const values = {ArrowUp:height - 20, ArrowDown:height + 20, Home:MIN, End:MAX};
    if (!(event.key in values)) return;
    event.preventDefault();
    changed = true;
    apply(values[event.key]);
    save();
  });
  grip.addEventListener("dblclick", () => {
    changed = true;
    apply(DEFAULT);
    save();
  });
})();
