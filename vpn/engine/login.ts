import type { SessionRecord } from "./session";
export interface LoginOptions {
  host: string;
  action?: "signup";
  partnerId?: string;
  independent?: boolean;
}
export interface PendingLogin {
  state: string;
  createdAt: number;
  expiresAt: number;
  claimed?: boolean;
  partnerId?: string;
  independent?: boolean;
}
export interface LoginSession extends SessionRecord {
  persistent?: boolean;
  partnerId?: string;
}
export interface LoginPorts<S extends LoginSession> {
  read(): Promise<PendingLogin | undefined>;
  write(value: PendingLogin): Promise<void>;
  remove(): Promise<void>;
  nonce(): string;
  authorize(state: string, options: LoginOptions): string;
  exchange(selector: string): Promise<S>;
  capture(): number;
  save(session: S, generation: number): Promise<boolean>;
  now?(): number;
}
export const accountOrigins = [
  "https://account.proton.me",
  "https://account.protonvpn.com",
];
export function isAccountUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      !url.username && !url.password && accountOrigins.includes(url.origin)
    );
  } catch {
    return false;
  }
}
export function forkPayload(
  message: unknown,
  appId: string,
): { state: string; selector: string; persistent: boolean } | undefined {
  if (!message || typeof message !== "object") return undefined;
  const input = message as { extension?: unknown; payload?: unknown };
  if (
    (input.extension && input.extension !== appId) ||
    !input.payload ||
    typeof input.payload !== "object"
  )
    return undefined;
  const data = input.payload as {
    state?: unknown;
    selector?: unknown;
    persistent?: unknown;
  };
  if (
    typeof data.state !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(data.state) ||
    typeof data.selector !== "string" ||
    !data.selector ||
    data.selector.length > 4096 ||
    /\s|[\x00-\x1f\x7f]/.test(data.selector)
  )
    return undefined;
  return {
    state: data.state,
    selector: data.selector,
    persistent: data.persistent === true,
  };
}
/** One worker owns durable login intent, single-use claiming and guarded session commit. */
export class LoginFlow<S extends LoginSession> {
  private generation = 0;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly ports: LoginPorts<S>) {}
  private serial<T>(run: () => Promise<T>): Promise<T> {
    const task = this.queue.then(run);
    this.queue = task.catch(() => {});
    return task;
  }
  private now(): number {
    return this.ports.now?.() ?? Date.now();
  }
  private check(generation: number): void {
    if (generation !== this.generation) throw new Error("VpnSignInSuperseded");
  }
  private valid(
    value: PendingLogin | undefined,
    state: string,
  ): value is PendingLogin {
    return (
      !!value &&
      value.state === state &&
      Number.isFinite(value.createdAt) &&
      Number.isFinite(value.expiresAt) &&
      value.createdAt <= this.now() &&
      value.expiresAt > this.now() &&
      value.expiresAt - value.createdAt === 15 * 60000
    );
  }
  begin(options: LoginOptions): Promise<string> {
    if (!options || !isAccountUrl(options.host))
      return Promise.reject(new Error("VpnSignInInvalidOrigin"));
    const host = new URL(options.host);
    if (
      host.pathname !== "/" ||
      host.search ||
      host.hash ||
      (options.action !== undefined && options.action !== "signup") ||
      (options.partnerId !== undefined &&
        (typeof options.partnerId !== "string" ||
          options.partnerId.length > 160)) ||
      (options.independent !== undefined &&
        typeof options.independent !== "boolean")
    )
      return Promise.reject(new Error("VpnSignInInvalidOptions"));
    const input = { ...options, host: host.origin },
      generation = ++this.generation;
    return this.serial(async () => {
      this.check(generation);
      const state = this.ports.nonce();
      if (!/^[A-Za-z0-9_-]{43}$/.test(state))
        throw new Error("VpnSignInInvalidNonce");
      const url = this.ports.authorize(state, input);
      if (
        !isAccountUrl(url) ||
        new URL(url).origin !== host.origin ||
        new URL(url).pathname !== "/authorize" ||
        new URL(url).searchParams.get("state") !== state
      )
        throw new Error("VpnSignInInvalidOrigin");
      const createdAt = this.now();
      await this.ports.write({
        state,
        createdAt,
        expiresAt: createdAt + 15 * 60000,
        partnerId: input.partnerId,
        independent: input.independent,
      });
      this.check(generation);
      return url;
    });
  }
  async owns(state: string): Promise<boolean> {
    return this.serial(async () => this.valid(await this.ports.read(), state));
  }
  async complete(input: {
    state: string;
    selector: string;
    persistent?: boolean;
  }): Promise<{ session: S; forkState: PendingLogin }> {
    if (!forkPayload({ payload: input }, ""))
      throw new Error("VpnSignInInvalidPayload");
    const generation = this.generation,
      sessionGeneration = this.ports.capture();
    const pending = await this.serial(async () => {
      this.check(generation);
      const value = await this.ports.read();
      this.check(generation);
      if (!this.valid(value, input.state) || value.claimed)
        throw new Error("VpnSignInInvalidState");
      // Keep a tombstone until expiry so duplicate relays never repeat the exchange.
      await this.ports.write({ ...value, claimed: true });
      this.check(generation);
      return value;
    });
    let session: S;
    try {
      session = await this.ports.exchange(input.selector);
    } catch {
      throw new Error("VpnSignInExchangeFailed");
    }
    this.check(generation);
    if (!this.valid(pending, input.state)) throw new Error("VpnSignInExpired");
    if (
      !session?.uid ||
      !session.accessToken ||
      !session.refreshToken ||
      ![session.uid, session.accessToken, session.refreshToken].every(
        (value) => typeof value === "string",
      )
    )
      throw new Error("VpnSignInInvalidSession");
    const value = {
      ...session,
      persistent: input.persistent === true,
      partnerId: pending.partnerId || undefined,
    };
    if (!(await this.ports.save(value, sessionGeneration)))
      throw new Error("VpnSignInSuperseded");
    this.check(generation);
    return { session: value, forkState: pending };
  }
  invalidate(): Promise<void> {
    this.generation++;
    return this.serial(() => this.ports.remove());
  }
}
