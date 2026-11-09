import IntlMessageFormat from 'intl-messageformat'
import DEFAULT_MESSAGES from '../../../_locales/en/messages.json'

import PORTUGUESE_MESSAGES from '../../../_locales/pt_BR/messages.json'

interface TranslationEntry {
  message: string;
}
interface Messages {
  [key: string]: TranslationEntry;
}

export const RTL_LANGUAGES = new Set<string>()
export function isRtlLocale(locale?: string): boolean { return false }

export default class I18n {
  private locales: string[];
  private locale = 'en'
  private messages: Messages | undefined;
  private defaultMessages: Messages;
  constructor(locale: string) {
    this.locales = [locale]
    this.defaultMessages = DEFAULT_MESSAGES
    this.messages = DEFAULT_MESSAGES
  }

  setLocales(locales:string[]):void {
    this.locales = locales
  }

  async load():Promise<void> {
    this.locale = /^en(?:-|$)/i.test(this.locales[0] || '') ? 'en' : 'pt-BR'
    this.messages = this.locale === 'en' ? DEFAULT_MESSAGES : PORTUGUESE_MESSAGES
  }

  public getLocale(): string {
    return this.locale
  }

  public isRTL(): boolean {
    return isRtlLocale(this.locale)
  }

  /**
   * Get a formatted message with the given name
   */
  public getMessage(messageName: string, content?: any, formats?: any): string {
    const string = this.doGetMessage(messageName)
    if (string) {
      const message = new IntlMessageFormat(string.message, this.locale, formats).format(content)
      if (!message) {
        return messageName
      }
      if (Array.isArray(message)) {
        return message.join('')
      }
      return message
    }
    return messageName
  }

  /**
   * Get message with given name from the default locale
   */
  private getDefaultLocaleMessage(messageName: string): TranslationEntry | null {
    if (!Object.hasOwnProperty.call(this.defaultMessages, messageName)) {
      console.warn(`WARN: No message found with name ${messageName} in default locale en`)
      return null
    }
    return this.defaultMessages[messageName]
  }

  /**
   * Get message with given name
   */
  private doGetMessage(messageName: string): TranslationEntry | null {
    if (!this.messages || !Object.hasOwnProperty.call(this.messages, messageName)) {
      console.warn(`No message found with name ${messageName} in locale ${this.locale}. Using default locale 'en'`)
      return this.getDefaultLocaleMessage(messageName)
    }
    return this.messages[messageName]
  }
}

export const i18n = new I18n('pt-BR')
