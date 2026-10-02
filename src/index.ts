import type { I18n, Messages } from './types.js'

export { createI18n, type I18nConfig } from './core.js'
export { cookieDetector, htmlLangDetector, navigatorDetector, queryDetector, storageDetector, type CookieOptions } from './detectors.js'
export { getDirection, matchLocale, negotiateLocale, parseAcceptLanguage } from './locale.js'
export type * from './types.js'

/**
 * Register your instance once to get typed keys, params and locales from the React hooks:
 *
 * ```ts
 * declare module 'i18next-lite' {
 *   interface Register {
 *     i18n: typeof i18n
 *   }
 * }
 * ```
 */
export interface Register {}

export type RegisteredI18n = Register extends { i18n: infer Instance extends I18n<any, any> } ? Instance : I18n<string, Messages>
export type RegisteredLocale = RegisteredI18n extends I18n<infer L, any> ? L : string
export type RegisteredMessages = RegisteredI18n extends I18n<any, infer M> ? M : Messages
