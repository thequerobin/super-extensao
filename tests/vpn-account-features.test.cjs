const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const load = require("./helpers/load-ts.cjs");
const root = path.resolve(__dirname, "..");
const { AccountProfile, accountTier, hasPaidAccess, canAccessServer } = load(
  path.join(root, "vpn/engine/account.ts"),
);
const { FeatureConfigStore, ConfiguredFeature } = load(
  path.join(root, "vpn/engine/features.ts"),
);
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
const free = { VPN: { MaxTier: 0 }, name: "free" };
const paid = { VPN: { MaxTier: 2 }, name: "paid" };
function fixture(initial = {}) {
  let now = 10000,
    owner = "A",
    revision = 0,
    saved = initial;
  const requests = [],
    writes = [],
    errors = [],
    updates = [];
  let refreshes = 0;
  const ports = {
    context: async () => ({ owner, revision }),
    read: async () => saved,
    write: async (cache) => {
      writes.push(cache);
      saved = cache;
    },
    remove: async () => {
      saved = {};
    },
    request: async () => {
      requests.push(1);
      return paid;
    },
    access: async () => {},
    refresh: async () => {
      refreshes++;
    },
    unauthorized: (e) => e.status === 401,
    canRefresh: (e) => !e.authRetried,
    freshness: async () => 100,
    blockingTTL: () => 1000,
    forceAllowed: (user) => !hasPaidAccess(user),
    backgroundError: (e) => errors.push(e),
    updated: (user) => updates.push(user),
    now: () => now,
  };
  return {
    client: new AccountProfile(ports),
    ports,
    requests,
    writes,
    errors,
    updates,
    advance: (ms) => {
      now += ms;
    },
    switch: (id = "B") => {
      owner = id;
      revision++;
    },
    saved: () => saved,
    refreshes: () => refreshes,
  };
}
test("account access preserves Free/paid restrictions and rejects invalid tiers", () => {
  assert.equal(accountTier(free), 0);
  assert.equal(accountTier(paid), 2);
  assert.equal(hasPaidAccess(paid), true);
  assert.equal(hasPaidAccess(free), false);
  for (const tier of [NaN, Infinity, -1, "2", undefined])
    assert.equal(accountTier({ VPN: { MaxTier: tier } }), 0);
  assert.equal(canAccessServer(undefined, 0), false);
  assert.equal(canAccessServer(free, 2), false);
  assert.equal(canAccessServer(paid, 2), true);
  for (const tier of [NaN, Infinity, -1])
    assert.equal(canAccessServer(paid, tier), false);
});
test("legacy account cache survives extraction without a request or storage migration", async () => {
  const f = fixture({ time: 10000, user: free });
  assert.equal(await f.client.get(), free);
  assert.equal(f.requests.length, 0);
  assert.equal(f.writes.length, 0);
});
test("simultaneous account requests share IO and wait for the cache commit", async () => {
  const f = fixture(),
    network = deferred(),
    write = deferred();
  f.ports.request = async () => {
    f.requests.push(1);
    return network.promise;
  };
  f.ports.write = async (c) => {
    f.writes.push(c);
    await write.promise;
  };
  let done = false;
  const a = f.client.get().then((u) => {
      done = true;
      return u;
    }),
    b = f.client.get();
  await tick();
  assert.equal(f.requests.length, 1);
  network.resolve(paid);
  await tick();
  assert.equal(done, false);
  write.resolve();
  assert.equal(await a, paid);
  assert.equal(await b, paid);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].owner, "A");
});
test("stale account cache is served while a single background request updates it", async () => {
  const f = fixture({ time: 9800, user: free }),
    network = deferred();
  f.ports.request = async () => {
    f.requests.push(1);
    return network.promise;
  };
  assert.equal(await f.client.get(), free);
  assert.equal(await f.client.get(), free);
  await tick();
  assert.equal(f.requests.length, 1);
  network.resolve(paid);
  await tick();
  assert.equal(f.saved().user, paid);
});
test("foreign or future-dated cache is fetched again without granting its paid plan", async () => {
  for (const cache of [
    { time: 10000, owner: "B", user: paid },
    { time: 99999, user: paid },
  ]) {
    const f = fixture(cache);
    f.ports.request = async () => {
      f.requests.push(1);
      return free;
    };
    assert.equal(await f.client.get(), free);
    assert.equal(f.requests.length, 1);
  }
});
test("forced Free refresh detects an upgrade, but paid cache respects normal freshness", async () => {
  const f = fixture({ time: 8000, user: free });
  assert.equal(await f.client.get(true, true), paid);
  assert.equal(f.requests.length, 1);
  const g = fixture({ time: 10000, user: paid });
  assert.equal(await g.client.get(true, true), paid);
  assert.equal(g.requests.length, 0);
});
test("forced refresh is limited within the TTL rather than permitting unlimited requests", async () => {
  const f = fixture({ time: 8000, user: free });
  f.ports.freshness = async () => 100000;
  f.ports.request = async () => {
    f.requests.push(1);
    return free;
  };
  for (let i = 0; i < 25; i++) {
    f.advance(1100);
    await f.client.get(true, true);
  }
  assert.equal(f.requests.length, 20);
  f.advance(100001);
  await f.client.get(true, true);
  assert.equal(f.requests.length, 21);
});
test("unhandled 401 refreshes once; a consumed transport retry is never repeated or hidden by stale data", async () => {
  for (const consumed of [false, true]) {
    const f = fixture({ time: 0, user: free });
    let calls = 0;
    f.ports.request = async () => {
      if (++calls === 1) throw { status: 401, authRetried: consumed };
      return paid;
    };
    if (consumed)
      await assert.rejects(f.client.get(true), (e) => e.status === 401);
    else assert.equal(await f.client.get(true), paid);
    assert.equal(f.refreshes(), consumed ? 0 : 1);
    assert.equal(calls, consumed ? 1 : 2);
  }
});
test("temporary failure retains stale account data without making it fresh", async () => {
  const f = fixture({ time: 0, user: free });
  f.ports.request = async () => {
    throw Error("offline");
  };
  assert.equal(await f.client.get(), free);
  assert.equal(f.saved().time, 0);
  assert.equal(f.writes.length, 0);
});
test("background authentication failure reports once without an unhandled rejection", async () => {
  const f = fixture({ time: 9800, user: free });
  f.ports.request = async () => {
    throw { status: 401, authRetried: true };
  };
  assert.equal(await f.client.get(), free);
  await tick();
  assert.equal(f.errors.length, 1);
  assert.equal(f.refreshes(), 0);
});
test("no login returns no account and never requests a token or profile", async () => {
  const f = fixture();
  f.switch("");
  f.ports.access = async () => {
    throw Error("must not run");
  };
  assert.equal(await f.client.get(), undefined);
  assert.equal(f.requests.length, 0);
});
test("logout invalidates a late account result and cannot resurrect its cache", async () => {
  const f = fixture(),
    network = deferred();
  f.ports.request = () => network.promise;
  const task = f.client.get(),
    rejected = assert.rejects(task, /VpnAccountChanged/);
  await tick();
  await f.client.forget();
  network.resolve(paid);
  await rejected;
  assert.equal(f.writes.length, 0);
  assert.equal(f.saved().user, undefined);
  assert.equal(f.updates.length, 0);
});
test("another login with the same UID does not share a pending request from the previous login", async () => {
  const f = fixture(),
    network = deferred();
  let calls = 0;
  f.ports.request = () =>
    ++calls === 1 ? network.promise : Promise.resolve(free);
  const old = f.client.get(),
    rejected = assert.rejects(old, /VpnAccountChanged/);
  await tick();
  f.switch("A");
  assert.equal(await f.client.get(), free);
  network.resolve(paid);
  await rejected;
  assert.equal(f.saved().user, free);
  assert.equal(f.writes.length, 1);
});
test("logout removal follows a pending write; a new account writes after removal", async () => {
  const f = fixture(),
    write = deferred(),
    events = [];
  let calls = 0;
  f.ports.write = async (c) => {
    events.push("write:" + c.owner);
    if (++calls === 1) await write.promise;
  };
  f.ports.remove = async () => {
    events.push("remove");
  };
  const old = f.client.get(),
    rejected = assert.rejects(old, /VpnAccountChanged/);
  await tick();
  const removing = f.client.forget();
  f.switch();
  const next = f.client.get();
  write.resolve();
  await rejected;
  await removing;
  await next;
  assert.deepEqual(events, ["write:A", "remove", "write:B"]);
  assert.equal(f.updates.length, 1);
});
test("account change during a cache read cannot return old cached data", async () => {
  const f = fixture(),
    read = deferred();
  f.ports.read = () => read.promise;
  const task = f.client.get(),
    rejected = assert.rejects(task, /VpnAccountChanged/);
  await tick();
  f.switch();
  read.resolve({ time: 10000, user: paid });
  await rejected;
});
test("failed persistence does not notify login success and a later request can recover", async () => {
  const f = fixture();
  f.ports.write = async () => {
    throw Error("disk");
  };
  await assert.rejects(f.client.get(), /disk/);
  assert.equal(f.updates.length, 0);
  f.ports.write = async () => {};
  assert.equal(await f.client.get(), paid);
});
test("device policy overrides user choice; user choice overrides defaults only when controllable", async () => {
  class Feature extends ConfiguredFeature {
    getDefaultControlMessage() {
      return "locked";
    }
    async getUserConfig() {
      return this.user;
    }
    getDefault() {
      return { value: false };
    }
  }
  for (const controllable of [true, false]) {
    const f = new Feature({
      controllable,
      config: { value: false },
      controlMessage: "policy",
    });
    f.user = { value: true };
    assert.equal((await f.getConfig()).value, controllable);
    assert.equal(f.getControlMessage(), "policy");
  }
  const f = new Feature({ controllable: true });
  assert.equal((await f.getConfig()).value, false);
  assert.equal(f.getControlMessage(), "locked");
});
test("managed configuration loads once and does not fall back to bundled config when empty", async () => {
  let calls = 0;
  const pending = deferred();
  const store = new FeatureConfigStore({
    managed: async () => {
      calls++;
      return pending.promise;
    },
    bundled: async () => {
      throw Error("must not run");
    },
    managedUnavailable: () => false,
  });
  const a = store.get("auto-connect"),
    b = store.get("secure-core");
  pending.resolve({});
  assert.equal((await a).controllable, true);
  await b;
  assert.equal(calls, 1);
});
test("managed storage failure is retryable and never silently unlocks device policy", async () => {
  let calls = 0,
    bundled = 0;
  const store = new FeatureConfigStore({
    managed: async () => {
      if (++calls === 1) throw Error("timeout");
      return { x: { controllable: false } };
    },
    bundled: async () => {
      bundled++;
      return {};
    },
    managedUnavailable: () => false,
  });
  await assert.rejects(store.get("x"), /timeout/);
  assert.equal((await store.get("x")).controllable, false);
  assert.equal(bundled, 0);
});
test("only unavailable managed storage falls back to bundled policy", async () => {
  const unavailable = Error("unavailable");
  const store = new FeatureConfigStore({
    managed: async () => {
      throw unavailable;
    },
    bundled: async () => ({
      x: { controllable: false, config: { value: true } },
    }),
    managedUnavailable: (e) => e === unavailable,
  });
  const result = await store.get("x");
  assert.equal(result.controllable, false);
  assert.equal(result.config.value, true);
});
test("replacing policy during a pending read prevents late results from restoring old permissions", async () => {
  const pending = deferred();
  const store = new FeatureConfigStore({
    managed: () => pending.promise,
    bundled: async () => ({}),
    managedUnavailable: () => false,
  });
  const task = store.get("x");
  store.set({ x: { controllable: false } });
  pending.resolve({ x: { controllable: true } });
  assert.equal((await task).controllable, false);
  assert.equal((await store.get("x")).controllable, false);
});
