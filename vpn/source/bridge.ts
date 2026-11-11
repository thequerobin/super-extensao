/* SPDX-License-Identifier: GPL-3.0-only */
// Compatibility boundary with the existing Proton engine. No credentials are
// exposed to the view; sign-in remains on the official Proton account page.
import { readSession } from "@vpn-engine/account/readSession";
import { openForkTab } from "@vpn-engine/account/openForkTab";
import { sendMessageToBackground as request } from "@vpn-engine/tools/sendMessageToBackground";
import { getSortedLogicals, isLogicalUp } from "@vpn-engine/vpn/getLogicals";
import { getUserContext } from "@vpn-engine/account/user/getUserContext";
import { getUserMaxTier } from "@vpn-engine/account/user/getUserMaxTier";
import {
  requireBestLogical,
  requireRandomLogical,
} from "@vpn-engine/vpn/getLogical";
import { pickServerInLogical } from "@vpn-engine/vpn/pickServerInLogical";
import { isServerUp } from "@vpn-engine/vpn/isServerUp";
import { assertServerAccess } from "@vpn-engine/vpn/assertServerAccess";
import { getSecureCorePredicate } from "@vpn-engine/vpn/getSecureCorePredicate";
import { getSplitTunnelingConfig } from "@vpn-engine/vpn/getSplitTunnelingConfig";
import { loadAllFeatures } from "@vpn-engine/vpn/features/loadAllFeatures";
import {
  getLastChoices,
  setLastChoice,
  forgetLastChoices,
  getLogicalsFilteredByChoice,
} from "@vpn-engine/vpn/lastChoice";
import { preventLeak } from "@vpn-engine/webrtc/preventLeak";
import { setWebRTCState } from "@vpn-engine/webrtc/setWebRTCState";
import { WebRTCState } from "@vpn-engine/webrtc/state";
import { storage } from "@vpn-engine/tools/storage";
import { getRuntime } from "@vpn-engine/tools/getRuntime";
import { updateLastActivityTime } from "@vpn-engine/tools/activity";
import type { Choice } from "@vpn-engine/vpn/lastChoice";
import type { Logical } from "@vpn-engine/vpn/Logical";
import type { User } from "@vpn-engine/account/user/User";
import type { AllFeatures } from "@vpn-engine/vpn/features/AllFeatures";
import type { StoredWebsiteFilterList } from "@vpn-engine/vpn/WebsiteFilter";

type ToggleName =
  | "secureCore"
  | "autoConnect"
  | "notification"
  | "preventWebrtcLeak"
  | "recents";
export function createEngine() {
  let user: User | undefined;
  let features: AllFeatures;
  let context: Awaited<ReturnType<typeof getUserContext>>;
  let logicals: Logical[] = [];
  let connected = false;
  const runtime = getRuntime();
  const checkAccess = () => {
    if (!user) throw new Error("No Proton session");
  };
  const summary = (logical: Logical) => ({
    id: String(logical.ID),
    name: logical.Name,
    country: logical.ExitCountry,
    city: logical.Translations?.City || logical.City || "",
    tier: logical.Tier,
    load: logical.Load,
    secureCore: Boolean(logical.Features & 1),
    available:
      isLogicalUp(logical, context.country, context.location) &&
      Boolean(logical.Servers?.some(isServerUp)),
    allowed: logical.Tier <= getUserMaxTier(user),
  });
  const featureSummary = () =>
    Object.fromEntries(
      (
        [
          "secureCore",
          "autoConnect",
          "notification",
          "preventWebrtcLeak",
          "recents",
        ] as ToggleName[]
      ).map((key) => {
        const item = features[key];
        return [
          key,
          {
            enabled: item.config.value,
            available: item.feature.isAvailable(),
            controllable:
              Boolean(user) && item.feature.isControllable() &&
              (key !== "secureCore" || getUserMaxTier(user) > 0),
            message: item.feature.getControlMessage(),
          },
        ];
      }),
    );
  return {
    async load(onProgress?: (snapshot: any) => void) {
      const session = await readSession();
      if (!session?.uid || !session.refreshToken) {
        user = undefined;
        logicals = [];
        connected = false;
        return { signedIn: false };
      }
      const [state, loadedFeatures, recents] = await Promise.all([
        request<any>("state"), loadAllFeatures(), getLastChoices(),
      ]);
      features = loadedFeatures;
      const local = {
        signedIn: true,
        features: featureSummary(),
        split: features.splitTunneling.config,
        splitControllable: false,
        state: {
          state: state?.server ? "connecting" : "disconnected",
          server: state?.server,
          error: state?.error,
        },
        recents,
      };
      onProgress?.(local);
      user = await request<User>("user");
      if (!user?.VPN) throw new Error("Unable to load Proton account");
      const tier = getUserMaxTier(user);
      const ready = {
        ...local,
        account: { name: user.VPN.Name, plan: user.VPN.PlanTitle || user.VPN.PlanName, tier },
        features: featureSummary(),
        splitControllable: features.splitTunneling.feature.isControllable() &&
          features.splitTunneling.feature.isAvailable(),
      };
      onProgress?.(ready);
      const [loadedContext, loadedLogicals] = await Promise.all([
        getUserContext(tier), getSortedLogicals(),
      ]);
      context = loadedContext;
      logicals = loadedLogicals;
      return { ...ready, servers: logicals.map(summary), features: featureSummary(), split: features.splitTunneling.config };
    },
    async signIn() {
      if (!(await browser.permissions.request({ permissions: ["proxy"] })))
        throw new Error("VPN permission was not granted.");
      await request("proxy");
      await openForkTab();
    },
    async connect(
      id?: string,
      pick: "fastest" | "random" = "fastest",
      choice?: Choice,
    ) {
      checkAccess();
      const candidates = (
        choice ? getLogicalsFilteredByChoice(logicals, choice) : logicals
      ).filter(
        getSecureCorePredicate(
          getUserMaxTier(user),
          features.secureCore.config,
        ),
      );
      const logical = id
        ? logicals.find((item) => String(item.ID) === id)
        : pick === "random"
          ? requireRandomLogical(candidates, context)
          : requireBestLogical(candidates, context);
      if (!logical) throw new Error("Server is no longer available.");
      assertServerAccess(user, logical);
      if (!isLogicalUp(logical, context.country, context.location))
        throw new Error("Server is under maintenance.");
      const server = pickServerInLogical(logical);
      if (!server || !isServerUp(server))
        throw new Error("No available server.");
      await updateLastActivityTime();
      await request("connect", {
        logical,
        server,
        splitTunneling: getSplitTunnelingConfig(
          getUserMaxTier(user),
          features.splitTunneling.config,
        ),
      });
      setLastChoice({
        connected: true,
        logicalId: logical.ID,
        exitCountry: logical.ExitCountry,
        requiredFeatures: logical.Features & 1,
        excludedFeatures: logical.Features & 1 ? 0 : 1,
        tier: logical.Tier,
        ...(!id ? { pick } : {}),
      });
    },
    async connectRecent(choice: Choice) {
      return this.connect(
        undefined,
        choice.pick === "random" ? "random" : "fastest",
        choice,
      );
    },
    async disconnect() {
      await request("disconnect");
    },
    async signOut() {
      await request("signOut");
      user = undefined;
      connected = false;
    },
    async checkConnection(time: number) {
      await request("connecting", { connectionAttemptTime: time });
    },
    async setToggle(name: ToggleName, value: boolean) {
      checkAccess();
      const item = features[name];
      if (
        !item?.feature.isAvailable() ||
        !item.feature.isControllable() ||
        (name === "secureCore" && getUserMaxTier(user) === 0)
      )
        throw new Error("This option cannot be changed.");
      await item.feature.getCacheItem().set({ value });
      item.config = { value };
      if (name === "preventWebrtcLeak") {
        await (connected
          ? preventLeak(value)
          : setWebRTCState(WebRTCState.CLEAR));
      }
      if (name === "recents" && !value) forgetLastChoices();
      return featureSummary();
    },
    async saveSplit(config: StoredWebsiteFilterList) {
      checkAccess();
      const item = features.splitTunneling;
      if (!item.feature.isAvailable() || !item.feature.isControllable())
        throw new Error("This option cannot be changed.");
      // Apply active connection rules before reporting the form as saved.
      if (connected)
        await request(
          "bypassList",
          getSplitTunnelingConfig(getUserMaxTier(user), config),
        );
      await item.feature.getCacheItem().set(config);
      item.config = config;
    },
    async readView() {
      return (
        (await storage.getItem<any>("interface-view")) ||
        (await storage.getItem<any>("view-state"))
      );
    },
    async saveView(value: { page: string; scrollTop: number }) {
      await storage.setItem("interface-view", value);
    },
    subscribe(listener: (type: string, data: any) => void) {
      const handler = (message: any, sender: any) => {
        if (
          message?.channel !== "super-vpn" ||
          message.respondTo !== "none" ||
          (sender?.id && sender.id !== runtime.id)
        )
          return;
        if (message.type === "changeState")
          connected = message.data?.state === "connected";
        if (
          message.type === "logicalUpdate" &&
          Array.isArray(message.data) &&
          context
        ) {
          logicals = message.data;
          listener("servers", logicals.map(summary));
          return;
        }
        listener(message.type, message.data);
      };
      runtime.onMessage.addListener(handler);
      return () => runtime.onMessage.removeListener(handler);
    },
  };
}
