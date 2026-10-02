import type { LocaleDetector } from './types.js'

// Detectors run only in the browser, after hydration. Each one fails soft: blocked storage,
// sandboxed iframes and the server simply yield "no preference".
const attempt = <T>(read: () => T): T | undefined => {
	try {
		return read()
	} catch {
		return undefined
	}
}

/** The browser's language preferences (`navigator.languages`). */
export const navigatorDetector = (): LocaleDetector => ({
	detect: () => attempt(() => (navigator.languages?.length ? navigator.languages : navigator.language))
})

/** A locale saved in `localStorage` (or another `Storage`). Remembers the user's choice. */
export const storageDetector = (key = 'locale', storage: () => Storage = () => localStorage): LocaleDetector => ({
	detect: () => attempt(() => storage().getItem(key)),
	persist: locale => void attempt(() => storage().setItem(key, locale))
})

export interface CookieOptions {
	/** Seconds. Defaults to one year. */
	maxAge?: number
	path?: string
	sameSite?: 'lax' | 'strict' | 'none'
}

/**
 * A locale saved in a cookie. Remembers the user's choice, and unlike storage the server can read it too,
 * e.g. in a Next.js `proxy.ts`/middleware.
 */
export const cookieDetector = (name = 'locale', { maxAge = 31_536_000, path = '/', sameSite = 'lax' }: CookieOptions = {}): LocaleDetector => {
	const prefix = `${encodeURIComponent(name)}=`
	return {
		detect: () =>
			attempt(() => {
				const entry = document.cookie.split('; ').find(cookie => cookie.startsWith(prefix))
				return entry ? decodeURIComponent(entry.slice(prefix.length)) : undefined
			}),
		persist: locale =>
			void attempt(() => {
				document.cookie = `${prefix}${encodeURIComponent(locale)}; Max-Age=${maxAge}; Path=${path}; SameSite=${sameSite}`
			})
	}
}

/** A locale in the URL query string, e.g. `?lang=bn`. */
export const queryDetector = (param = 'lang'): LocaleDetector => ({
	detect: () => attempt(() => new URLSearchParams(location.search).get(param))
})

/** The `lang` attribute of `<html>`, e.g. one set by the server. */
export const htmlLangDetector = (): LocaleDetector => ({
	detect: () => attempt(() => document.documentElement.lang)
})
