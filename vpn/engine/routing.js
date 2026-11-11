/* SPDX-License-Identifier: GPL-3.0-only */
// Pure routing core: no sessions, credentials, storage, network or browser writes.
(function () {
  "use strict";
  const localExclusions = ["localhost", "127.0.0.1", "127.0.0.0/8", "127.0.0.1:80", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "[::1]", "<local>"];
  const serviceInclusions = [".protonvpn.net", ".protonvpn.com"];

  // Self-contained on purpose: the PAC and the icon execute this same function.
  // PAC may supply isInNet for DNS-based CIDR rules; the icon never resolves DNS.
  function routeHost(host, port, policy, isInNetFn) {
    host = host.toLowerCase();
    function ipv4(value) {
      if (!/^\d+(\.\d+){3}$/.test(value)) return undefined;
      const parts = value.split(".").map(Number);
      if (parts.some(part => part > 255)) return undefined;
      return parts.reduce((sum, part) => (sum * 256 + part) >>> 0, 0);
    }
    function matches(rule) {
      rule = rule.toLowerCase();
      if (rule === "<local>") return !host.includes(".") && !host.includes(":");
      const cidr = rule.match(/^(\d+(?:\.\d+){3})\/(\d+)$/);
      if (cidr) {
        const bits = Number(cidr[2]), network = ipv4(cidr[1]);
        if (bits > 32 || network === undefined) return false;
        const mask = bits ? (0xffffffff << (32 - bits)) >>> 0 : 0;
        if (isInNetFn) {
          const dottedMask = [24, 16, 8, 0].map(shift => (mask >>> shift) & 255).join(".");
          return isInNetFn(host, cidr[1], dottedMask);
        }
        const ip = ipv4(host);
        return ip !== undefined && (ip & mask) === (network & mask);
      }
      return rule.startsWith(".") ? host.endsWith(rule) : host === rule || host + ":" + port === rule;
    }
    // Chromium's implicit bypasses also apply to the include-only PAC.
    if (host === "localhost" || host.endsWith(".localhost") || host === "[::1]" ||
        /^127\./.test(host) || /^169\.254\./.test(host) || /^\[fe[89ab]/i.test(host)) return false;
    if ((policy.includeOnly !== undefined || isInNetFn) && (!host.includes(".") ||
        /^(0|10|127|192\.168|172\.1[6789]|172\.2\d|172\.3[01]|169\.254|192\.88\.99)\./.test(host) ||
        (ipv4(host) !== undefined && (ipv4(host) & 0xffffff00) === (0xc0000200 | 0)))) return false;
    if ((policy.bypassList || []).some(matches)) return false;
    return policy.includeOnly === undefined || policy.includeOnly.some(matches);
  }
  function rulesList(value) {
    if (!Array.isArray(value) || value.some(rule => typeof rule !== "string"))
      throw new Error("VpnInvalidRoutingRules");
    return [...value];
  }
  function createFixedConfig(host, port, split = {}, options = {}) {
    const domains = rulesList(split.filteredDomains || []);
    const include = split.mode === "include";
    const rules = {
      singleProxy: { scheme: options.scheme || "https", host, port },
      bypassList: [
        ...(include ? [] : domains),
        ...(options.excludeApi === false ? [] : rulesList(options.apiExclusions || [])),
        ...rulesList(options.localExclusions || localExclusions),
      ],
    };
    if (include) rules.includeOnly = [...domains, ...serviceInclusions];
    return { mode: "fixed_servers", rules };
  }
  function createPacScript(config, excludedLocal = localExclusions) {
    const proxy = config.rules.singleProxy;
    if (!["http", "https"].includes(proxy.scheme) ||
        !/^(?:[a-z0-9._-]+|\[[a-f0-9:]+\])$/i.test(proxy.host) ||
        !Number.isInteger(proxy.port) || proxy.port < 1 || proxy.port > 65535)
      throw new Error("VpnInvalidProxyEndpoint");
    const policy = { bypassList: rulesList(config.rules.bypassList).filter(rule => !excludedLocal.includes(rule)) };
    if (config.rules.includeOnly !== undefined) policy.includeOnly = rulesList(config.rules.includeOnly);
    const result = proxy.scheme.toUpperCase() + " " + proxy.host + ":" + proxy.port;
    return { mode: "pac_script", pacScript: { data:
      "var superRoute = " + routeHost.toString() + ";\n" +
      "function FindProxyForURL(url, host) {\n" +
      "var match = url.match(/^[a-z]+:\\/\\/[^/]*:(\\d+)(?:\\/|$)/i);\n" +
      "var port = match ? match[1] : (/^(https|wss):/i.test(url) ? '443' : '80');\n" +
      "return superRoute(host, port, " + JSON.stringify(policy) + ", isInNet) ? " + JSON.stringify(result) + " : 'DIRECT';\n}" } };
  }
  function usesVpn(url, policy) {
    let target;
    try { target = new URL(url); } catch { return false; }
    if (!["http:", "https:", "ws:", "wss:"].includes(target.protocol)) return false;
    const port = target.port || (["https:", "wss:"].includes(target.protocol) ? "443" : "80");
    return routeHost(target.hostname, port, policy);
  }
  const api = Object.freeze({ createFixedConfig, createPacScript, usesVpn });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.SuperVpnRouting = api;
})();
