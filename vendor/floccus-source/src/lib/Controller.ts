import IController from './interfaces/Controller'

declare const IS_BROWSER: boolean

interface FloccusWorker {
  postMessage(data: any): void
  addEventListener(fn: (data: any) => void): () => void
}

export default class Controller implements IController {
  public static singleton: IController
  private worker: FloccusWorker|null
  private key: string|null|undefined

  static async getSingleton():Promise<IController> {
    if (!this.singleton) {
      if (IS_BROWSER) {
        // otherwise load the proxy
        this.singleton = new Controller
      } else {
        // If we're not on the web, laod the implementation directly
        this.singleton = new (await import('./native/NativeController')).default
      }
    }
    return this.singleton
  }

  constructor(worker?: FloccusWorker) {
    this.worker = worker
  }

  async getWorker(): Promise<FloccusWorker> {
    const raw = await this.getRawWorker()
    return {
      postMessage: data => raw.postMessage({...data, channel:'super-sync'}),
      addEventListener: listener => raw.addEventListener(data => { if(data && data.channel === 'super-sync') listener(data) })
    }
  }

  async getRawWorker(): Promise<FloccusWorker> {
    if (this.worker) {
      return Promise.resolve(this.worker)
    }
    if (!navigator.userAgent.includes('Firefox') && navigator.serviceWorker?.controller) {
      return navigator.serviceWorker.ready.then((registration) => ({
        postMessage: (...args) => registration.active.postMessage(...args),
        addEventListener: (fn) => {
          const listener = (event) => fn(event.data)
          navigator.serviceWorker.addEventListener('message', listener)
          return () => navigator.serviceWorker.removeEventListener('message', listener)
        },
      }))
    }
    if (IS_BROWSER) {
      const browser = (await import('../lib/browser-api')).default
      const listeners = new Set<(data: any) => void>()
      return {
        postMessage: (data) => {
          browser.runtime.sendMessage(data).then(
            response => listeners.forEach(listener => listener(response)),
            error => {
              const response = { channel: data.channel, type: data.type + 'Response', error: error.message, params: [] }
              listeners.forEach(listener => listener(response))
              console.warn(error)
            },
          )
        },
        addEventListener: (listener) => {
          listeners.add(listener)
          browser.runtime.onMessage.addListener(listener)
          return () => {
            listeners.delete(listener)
            browser.runtime.onMessage.removeListener(listener)
          }
        },
      }
    }
  }

  async cancelSync(accountId, keepEnabled): Promise<void> {
    console.log('Waiting for service worker readiness')
    const worker = await this.getWorker()
    const message = {type: 'cancelSync', params: [accountId, keepEnabled]}
    worker.postMessage(message)

  }

  onStatusChange(listener): () => void {
    const eventListener = (data) => {
      const {type} = data
      if (type === 'status:update') {
        listener()
      }
    }
    let worker, removeListener
    this.getWorker().then(w => {
      worker = w
      removeListener = worker.addEventListener(eventListener)
    })
    return () => {
      removeListener && removeListener()
    }
  }

  async scheduleSync(accountId, wait): Promise<void> {
    console.log('Waiting for service worker readiness')
    const worker = await this.getWorker()
    const message = {type: 'scheduleSync', params: [accountId, wait]}
    worker.postMessage(message)

  }

  async scheduleAll(): Promise<void> {
    console.log('Waiting for service worker readiness')
    const worker = await this.getWorker()
    const message = {type: 'scheduleAll', params: []}
    worker.postMessage(message)

  }

  async setEnabled(enabled: boolean): Promise<void> {
    const worker = await this.getWorker()
    const message = {type: 'setEnabled', params: [enabled]}
    worker.postMessage(message)

  }

  async syncAccount(accountId, strategy, forceSync = false): Promise<void> {
    console.log('Waiting for service worker readiness')
    const worker = await this.getWorker()
    const message = {type: 'syncAccount', params: [accountId, strategy, forceSync]}

    return new Promise((resolve) => {
      const eventListener = (data) => {
        if (data.type === 'syncAccountResponse') {
          resolve()

          removeEventListener()
        }
      }
      const removeEventListener = worker.addEventListener(eventListener)
      worker.postMessage(message)

    })
  }

  async unlock(key): Promise<void> {
    console.log('Waiting for service worker readiness')
    const worker = await this.getWorker()
    const message = {type: 'unlock', params: [key]}
    return new Promise((resolve,reject) => {
      const remove=worker.addEventListener(data=>{ if(data.type!=='unlockResponse')return;remove();if(data.error)reject(new Error(data.error));else resolve() })
      worker.postMessage(message)
    })
  }

  async getUnlocked(): Promise<boolean> {
    console.log('Waiting for service worker readiness')
    const worker = await this.getWorker()

    return new Promise((resolve, reject) => {
      const eventListener = (data) => {
        if (data.type === 'getUnlockedResponse') {
          removeEventListener()
          if (data.error) reject(new Error(data.error))
          else resolve(data.params[0])
        }
      }
      const removeEventListener = worker.addEventListener(eventListener)
      const message = { type: 'getUnlocked', params: [] }
      worker.postMessage(message)

    })
  }

  async onLoad() {
    // noop
  }
}
