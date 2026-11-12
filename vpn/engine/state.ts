import { ConnectionLifecycle } from "./lifecycle";

export interface CredentialPair {
  Username: string;
  Password: string;
}
export interface StateServer {
  name: string;
}
export interface ConnectionData<S> {
  server?: S;
  error?: unknown;
  credsData?: CredentialPair;
  credsTry?: number;
  starting?: boolean;
}
export interface MachineState<S> {
  name: "on" | "off" | "loggedout";
  initializedAt: number;
  proxyEnabled: boolean;
  data: ConnectionData<S>;
}
export type ConnectionPhase =
  | "connecting"
  | "connected"
  | "disconnected"
  | "logged-out";
export interface StatePorts<S extends StateServer, C extends CredentialPair> {
  readServer(): Promise<S | undefined>;
  saveServer(server?: S): Promise<unknown>;
  signedIn(): Promise<boolean>;
  autoConnect(): Promise<void>;
  invalidate(): void;
  cancelCredentials(): void;
  loadCredentials(): Promise<C | undefined>;
  getCredentials(): Promise<C | undefined>;
  credentialsValid(): Promise<boolean>;
  mayReplace(previous: CredentialPair | undefined, next: C): boolean;
  apply(server: S, current: () => boolean): Promise<boolean>;
  hasProxy(): Promise<boolean>;
  clearProxy(): Promise<unknown>;
  probe(server: S, current: () => boolean): Promise<void>;
  probeInterval(): number;
  activity(): Promise<unknown>;
  activityInterval(): number;
  isNetworkError(error: unknown): boolean;
  networkWarning(): unknown;
  error(code: "missing-server" | "proxy-unavailable" | "timeout"): unknown;
  changed(state: MachineState<S>): void;
  present(phase: ConnectionPhase, state: MachineState<S>): void;
  connected(server: S, notify: boolean): void;
  disconnected(error?: unknown): void;
  failed(error: unknown): void;
  now?(): number;
}

/** Own connection intent, transitions and recovery. Service and browser IO are ports. */
export class ConnectionMachine<
  S extends StateServer,
  C extends CredentialPair,
> {
  readonly lifecycle = new ConnectionLifecycle();
  private state?: MachineState<S>;
  private boot?: Promise<void>;
  private persistence: Promise<unknown> = Promise.resolve();
  private attempt?: { generation: number; promise: Promise<boolean> };
  private recovery?: { generation: number; promise: Promise<void> };
  private probing?: Promise<void>;
  private cleanupNeeded?: MachineState<S>;
  private cleanup?: { state: MachineState<S>; promise: Promise<void> };
  private lastProbe = -Infinity;
  private lastActivity = -Infinity;
  private notified = false;
  private retryRequested = false;
  private lastRetry = -Infinity;
  constructor(private readonly ports: StatePorts<S, C>) {}
  private now(): number {
    return this.ports.now?.() ?? Date.now();
  }
  private valid(state: MachineState<S>, generation: number): boolean {
    return this.state === state && this.lifecycle.isCurrent(generation);
  }
  private invalidate(): number {
    const generation = this.lifecycle.advance();
    this.ports.invalidate();
    return generation;
  }
  peek(): MachineState<S> | undefined {
    return this.state;
  }
  get(): MachineState<S> {
    if (!this.state) {
      this.state = {
        name: "off",
        initializedAt: this.now(),
        proxyEnabled: false,
        data: {},
      };
      this.ports.changed(this.state);
      const initial = this.state,
        generation = this.lifecycle.capture();
      this.boot = this.restore(initial, generation);
    }
    return this.state;
  }
  async ready(): Promise<void> {
    this.get();
    await this.boot;
  }
  private async restore(
    initial: MachineState<S>,
    generation: number,
  ): Promise<void> {
    try {
      const server = await this.ports.readServer();
      if (!this.valid(initial, generation)) return;
      if (server) {
        this.activate({ server }, server.name);
        void this.refresh().catch((error) => this.ports.failed(error));
      } else {
        const signedIn = await this.ports.signedIn();
        if (!this.valid(initial, generation)) return;
        this.transition(signedIn ? "off" : "loggedout", {});
        const current = this.lifecycle.guard();
        await this.persistence;
        if (signedIn && current()) await this.ports.autoConnect();
      }
    } catch (error) {
      if (this.valid(initial, generation)) this.transition("off", { error });
      this.ports.failed(error);
    }
  }
  private transition(
    name: MachineState<S>["name"],
    data: ConnectionData<S>,
  ): MachineState<S> {
    this.invalidate();
    // Explicit commands also settle readiness without restoring an old intent later.
    this.boot ||= Promise.resolve();
    const state = (this.state = {
      name,
      initializedAt: this.now(),
      proxyEnabled: false,
      data,
    });
    this.notified = false;
    this.lastProbe = -Infinity;
    this.retryRequested = false;
    this.ports.changed(state);
    this.persistence = this.persistence
      .catch(() => undefined)
      .then(() => this.ports.saveServer(data.server));
    void this.persistence.catch((error) => this.ports.failed(error));
    this.cleanupNeeded = name === "on" ? undefined : state;
    if (name !== "on") {
      this.ports.cancelCredentials();
      this.ports.present(
        name === "loggedout" ? "logged-out" : "disconnected",
        state,
      );
      void this.clearDisconnected(state);
    }
    return state;
  }
  private clearDisconnected(state: MachineState<S>): Promise<void> {
    if (this.cleanup?.state === state) return this.cleanup.promise;
    const promise = this.ports
      .clearProxy()
      .then(() => {
        if (this.cleanupNeeded === state) this.cleanupNeeded = undefined;
      })
      .catch((error) => {
        if (this.state !== state) return;
        state.data.error = error;
        this.ports.present(
          state.name === "loggedout" ? "logged-out" : "disconnected",
          state,
        );
        this.ports.failed(error);
      });
    this.cleanup = { state, promise };
    void promise.finally(() => {
      if (this.cleanup?.promise === promise) this.cleanup = undefined;
    });
    return promise;
  }
  logIn(): void {
    this.transition("off", {});
  }
  logOut(): void {
    this.transition("loggedout", {});
  }
  disconnect(error?: unknown): void {
    this.transition("off", error ? { error } : {});
    this.ports.disconnected(error);
  }
  async connect(data: ConnectionData<S>, previousName?: string): Promise<void> {
    this.boot ||= Promise.resolve();
    const generation = this.invalidate();
    const previous =
      previousName === undefined ? await this.ports.readServer() : undefined;
    if (!this.lifecycle.isCurrent(generation)) return;
    this.activate(data, previousName ?? previous?.name);
    // Connection completion is observed through state; callers keep the existing API.
    void this.refresh().catch((error) => this.ports.failed(error));
  }
  private activate(data: ConnectionData<S>, previousName?: string): void {
    if (!data.server) {
      this.disconnect(this.ports.error("missing-server"));
      return;
    }
    const state = this.transition("on", { ...data, starting: true });
    this.notified = previousName === data.server.name;
    this.ports.present("connecting", state);
  }
  async reconfigure(update: (server: S) => S): Promise<void> {
    const state = this.state;
    if (state?.name !== "on" || !state.data.server) return;
    const server = update(state.data.server);
    this.activate(
      { ...state.data, server },
      this.notified ? server.name : undefined,
    );
    await this.refresh();
  }
  setCredentials(credentials?: C): void {
    const state = this.state;
    if (state?.name !== "on" || !credentials?.Username || !credentials.Password)
      return;
    const same =
      state.data.credsData?.Username === credentials.Username &&
      state.data.credsData?.Password === credentials.Password;
    if (!same && !this.ports.mayReplace(state.data.credsData, credentials))
      return;
    state.data.credsData = {
      Username: credentials.Username,
      Password: credentials.Password,
    };
    state.data.credsTry = 0;
    void this.connectCurrentServer().catch((error) => this.ports.failed(error));
  }
  connectCurrentServer(): Promise<boolean> {
    const state = this.state,
      generation = this.lifecycle.capture();
    if (state?.name !== "on" || !state.data.server)
      return Promise.resolve(false);
    if (this.attempt?.generation === generation) return this.attempt.promise;
    const promise = this.apply(state, generation);
    this.attempt = { generation, promise };
    void promise
      .finally(() => {
        if (this.attempt?.promise === promise) this.attempt = undefined;
      })
      .catch(() => {});
    return promise;
  }
  private async apply(
    state: MachineState<S>,
    generation: number,
  ): Promise<boolean> {
    const current = () => this.valid(state, generation);
    try {
      const credentials = await this.ports.getCredentials();
      if (!current()) return false;
      const validCredentials = await this.ports.credentialsValid();
      if (!current()) return false;
      if (!credentials?.Username || !credentials.Password || !validCredentials)
        throw this.ports.error("proxy-unavailable");
      state.data.credsData = {
        Username: credentials.Username,
        Password: credentials.Password,
      };
      if (!(await this.ports.apply(state.data.server!, current)) || !current())
        return false;
      state.proxyEnabled = true;
      delete state.data.starting;
      delete state.data.error;
      this.ports.present("connected", state);
      this.ports.connected(state.data.server!, !this.notified);
      this.notified = true;
      return true;
    } catch (error) {
      if (current()) this.connectionFailed(error);
      return false;
    }
  }
  refresh(): Promise<void> {
    const state = this.state,
      generation = this.lifecycle.capture();
    if (!state) return Promise.resolve();
    if (this.recovery?.generation === generation) return this.recovery.promise;
    const promise = this.recover(state, generation);
    this.recovery = { generation, promise };
    void promise
      .finally(() => {
        if (this.recovery?.promise === promise) this.recovery = undefined;
      })
      .catch(() => {});
    return promise;
  }
  private async recover(
    state: MachineState<S>,
    generation: number,
  ): Promise<void> {
    const current = () => this.valid(state, generation);
    try {
      if (state.name !== "on") {
        if (this.cleanupNeeded === state) await this.clearDisconnected(state);
        return;
      }
      const applied = await this.ports.hasProxy();
      if (!current()) return;
      if (this.retryRequested && this.now() - this.lastRetry >= 20000) {
        this.retryRequested = false;
        this.lastRetry = this.now();
        state.data.starting = true;
      }
      state.proxyEnabled = applied && !state.data.starting;
      if (!state.proxyEnabled) {
        this.ports.present("connecting", state);
        let credentials = await this.ports.loadCredentials();
        if (!current()) return;
        credentials ||= await this.ports.getCredentials();
        if (!current()) return;
        if (!credentials?.Username || !credentials.Password) {
          if (this.ports.isNetworkError(state.data.error)) return;
          this.disconnect(this.ports.error("proxy-unavailable"));
          return;
        }
        if (this.ports.mayReplace(state.data.credsData, credentials)) {
          state.data.credsData = {
            Username: credentials.Username,
            Password: credentials.Password,
          };
          state.data.credsTry = 0;
        }
        const confirmed = await this.connectCurrentServer();
        if (!current()) return;
        if (!confirmed) {
          if (!this.ports.isNetworkError(state.data.error))
            this.disconnect(this.ports.error("proxy-unavailable"));
          return;
        }
      } else if (state.data.error) {
        // Revalidate credentials before clearing a warning on a confirmed proxy.
        const credentials = await this.ports.getCredentials();
        if (!current() || !credentials) return;
        delete state.data.error;
        this.ports.present("connected", state);
      }
      if (
        current() &&
        this.now() - this.lastActivity >= this.ports.activityInterval()
      ) {
        this.lastActivity = this.now();
        await this.ports.activity().catch((error) => this.ports.failed(error));
      }
      if (!current()) return;
      await this.probe(state, generation).catch((error) => {
        if (!current()) return;
        if (this.ports.isNetworkError(error)) this.networkFailed(error);
        else this.ports.failed(error);
      });
    } catch (error) {
      if (current()) this.connectionFailed(error);
    }
  }
  private async probe(
    state: MachineState<S>,
    generation: number,
  ): Promise<void> {
    if (
      this.probing ||
      !state.data.server ||
      this.now() - this.lastProbe < this.ports.probeInterval()
    )
      return;
    this.lastProbe = this.now();
    const promise = this.ports.probe(state.data.server, () =>
      this.valid(state, generation),
    );
    this.probing = promise;
    try {
      await promise;
    } finally {
      if (this.probing === promise) this.probing = undefined;
    }
  }
  private connectionFailed(error: unknown): void {
    if (this.ports.isNetworkError(error)) this.networkFailed(error);
    else {
      this.disconnect(error);
      this.ports.failed(error);
    }
  }
  networkFailed(error: unknown): void {
    const state = this.state;
    if (state?.name === "on") {
      state.data.error = this.ports.networkWarning();
      this.ports.present(
        state.proxyEnabled ? "connected" : "connecting",
        state,
      );
    }
    this.ports.failed(error);
  }
  retryConnection(): Promise<void> {
    if (this.state?.name !== "on") return Promise.resolve();
    this.retryRequested = true;
    return this.refresh();
  }
  checkConnectingState(): void {
    const state = this.state;
    if (
      state?.name === "on" &&
      !state.proxyEnabled &&
      this.now() - state.initializedAt > 30000
    ) {
      // A transient network failure retains the connection intent for the next alarm.
      if (!state.data.error || !this.ports.isNetworkError(state.data.error))
        this.disconnect(state.data.error || this.ports.error("timeout"));
    }
  }
}
