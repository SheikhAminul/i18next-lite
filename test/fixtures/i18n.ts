import { createI18n, type LocaleDetector } from '../../src/index.js'
import { ar, en } from './messages.js'

/** A promise you settle by hand, to control when a lazy locale finishes loading. */
export const deferred = <T>() => {
	let resolve!: (value: T) => void
	let reject!: (reason: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

export interface TestOptions {
	locale?: string
	detectors?: LocaleDetector[]
	bn?: () => Promise<unknown>
	onMissingKey?: (info: { key: string; locale: string }) => string | void
}

/** en and ar are bundled; bn and bn-BD are lazy, bn-BD falls back to bn then en. */
export const createTestI18n = (options: TestOptions = {}) => {
	return createI18n({
		defaultLocale: 'en',
		locale: options.locale,
		detectors: options.detectors,
		onMissingKey: options.onMissingKey,
		locales: {
			en,
			ar,
			bn: (options.bn ?? (() => import('./bn.json'))) as () => Promise<typeof import('./bn.json')>,
			'bn-BD': () => Promise.resolve({ default: { greeting: 'হ্যালো (BD), {name}!' } })
		}
	})
}

export type TestI18n = ReturnType<typeof createTestI18n>

declare module '../../src/index.js' {
	interface Register {
		i18n: TestI18n
	}
}
