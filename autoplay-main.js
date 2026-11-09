/* Runs in MAIN so page scripts also go through the patched play() method.
   Like the source extension, a genuine interaction releases media in this frame. */
(function () {
  "use strict";
  const nativePlay = HTMLMediaElement.prototype.play;
  const nativePause = HTMLMediaElement.prototype.pause;
  const attributes = ["autoplay","auto_play","autostart","autostarts","autostartup","playing","playnext"];
  let blocking = true;
  let interacted = false;
  let configured = false;
  let resolveConfig;
  const configReady = new Promise(resolve => {resolveConfig = resolve;});
  const blocked = new Map();
  const roots = new WeakSet();
  let scheduled = false;
  function shouldBlock() { return blocking && !interacted; }
  function remember(media, resume = false) {
    if (!blocked.has(media)) blocked.set(media,{attributes:[],resume:false});
    const entry = blocked.get(media);
    entry.resume ||= resume;
    return entry;
  }
  function scrub(media) {
    if (!shouldBlock()) return;
    const auto = media.autoplay;
    const entry = remember(media, auto || !media.paused);
    for (const attribute of attributes) {
      if (media.hasAttribute(attribute)) {
        if (!entry.attributes.some(([name]) => name === attribute)) entry.attributes.push([attribute,media.getAttribute(attribute)]);
        media.removeAttribute(attribute);
      }
    }
    if (!media.paused) {try {nativePause.call(media);} catch {}}
  }
  function release(resume) {
    for (const [media, entry] of blocked) {
      if (!media.isConnected) continue;
      for (const [name, value] of entry.attributes) if (!media.hasAttribute(name)) media.setAttribute(name,value);
      // A click in the page unlocks media but does not start unrelated players.
      if (resume && entry.resume) nativePlay.call(media).catch(() => {});
    }
    blocked.clear();
  }
  function scan(root) {
    if (root instanceof HTMLMediaElement) scrub(root);
    if (!root.querySelectorAll) return;
    root.querySelectorAll("video,audio").forEach(scrub);
    root.querySelectorAll("*").forEach(element => {if (element.shadowRoot) observe(element.shadowRoot);});
  }
  function scheduleScan() {
    if (scheduled || !shouldBlock()) return;
    scheduled = true;
    queueMicrotask(() => {scheduled = false; scan(document);});
  }
  function observe(root) {
    if (roots.has(root)) return;
    roots.add(root);
    const observer = new MutationObserver(mutations => {
      if (!shouldBlock()) return;
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.target instanceof HTMLMediaElement) scrub(mutation.target);
        for (const node of mutation.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      }
      // Don't retain removed media indefinitely on long-lived feeds.
      for (const media of blocked.keys()) if (!media.isConnected) blocked.delete(media);
    });
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:attributes});
    scan(root);
  }
  for (const type of ["play","playing","canplay","loadeddata"]) {
    document.addEventListener(type, event => {
      if (shouldBlock() && event.target instanceof HTMLMediaElement) scrub(event.target);
    },true);
  }
  function interact(event) {
    if (!event.isTrusted) return;
    interacted = true;
    release(false);
  }
  for (const type of ["pointerdown","touchstart","keydown","click"]) window.addEventListener(type,interact,{capture:true,passive:true});
  HTMLMediaElement.prototype.play = function (...args) {
    const media = this;
    function perform() {
      if (!shouldBlock()) return nativePlay.apply(media,args);
      remember(media,true);
      try {nativePause.call(media);} catch {}
      return Promise.reject(new DOMException("Reprodução automática bloqueada pela Super Extensão.","NotAllowedError"));
    }
    if (!configured && !interacted) return configReady.then(perform);
    return perform();
  };
  // New shadow trees need their own observer, including closed shadow roots.
  const attachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (...args) {
    const root = attachShadow.apply(this,args);
    observe(root);
    return root;
  };
  document.addEventListener("super-extensao:autoplay-config", event => {
    try {
      const value = JSON.parse(event.detail);
      if (typeof value.block !== "boolean") return;
      const wasBlocking = blocking;
      blocking = value.block;
      if (!configured) {configured = true;resolveConfig();}
      if (!blocking) release(true);
      else {if (!wasBlocking) interacted = false; scheduleScan();}
    } catch {}
  });
  observe(document);
  document.dispatchEvent(new Event("super-extensao:autoplay-ready"));
})();
