import { cookieDetector, createI18n } from 'i18next-lite'
import en from './messages/en'

// Shared by Server Components, Client Components and the proxy. Only `en` is bundled up front;
// the other locales are code-split and loaded on demand, on the server and in the browser.
export const i18n = createI18n({
	defaultLocale: 'en',
	locales: {
		en,
		bn: () => import('./messages/bn.json'),
		ar: () => import('./messages/ar.json')
	}
})

export type Locale = (typeof i18n.locales)[number]

/** Remembers the visitor's choice; `proxy.ts` reads it on their next visit to `/`. */
export const localeCookie = cookieDetector('NEXT_LOCALE')

declare module 'i18next-lite' {
	interface Register {
		i18n: typeof i18n
	}
}
