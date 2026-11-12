// Account-page adapter for the Super Extensão's own pending login sessions.
// Other extensions and Proton VPN logins continue through the original API.
(() => {
  if (!['https://account.proton.me', 'https://account.protonvpn.com'].includes(location.origin)) return;
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.sendMessage) return;
  const original = runtime.sendMessage;
  const channel = 'super-vpn-auth';
  const pending = new Map();
  window.addEventListener('message', event => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin || data?.channel !== channel || data.direction !== 'response') return;
    const complete = pending.get(data.id);
    if (complete) complete(data.result);
  });
  runtime.sendMessage = function (...args) {
    const [extensionId, message] = args;
    if (extensionId !== 'jplgfhpmjnbigmhklmmbgecoobifkmpa' || message?.type !== 'fork' || typeof message.payload?.state !== 'string' || typeof message.payload?.selector !== 'string') {
      return original.apply(this, args);
    }
    const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
    const id = crypto.randomUUID();
    const attempt = new Promise(resolve => {
      const timer = setTimeout(() => { pending.delete(id); resolve({handled: false}); }, 30000);
      pending.set(id, result => {clearTimeout(timer); pending.delete(id); resolve(result);});
      // Forward only fields required to consume the fork. Never relay account passwords or keys.
      const {state, selector, persistent} = message.payload;
      window.postMessage({channel, direction: 'request', id, message: {
        type: 'fork', payload: {state, selector, persistent: persistent === true}
      }}, location.origin);
    }).then(result => {
      if (result?.handled) {
        if (callback) {callback(result.response); return;}
        return result.response;
      }
      return original.apply(runtime, args);
    });
    if (!callback) return attempt;
    void attempt;
  };
})();
