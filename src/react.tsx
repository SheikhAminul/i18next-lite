'use client'

import { createContext, use, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import type { RegisteredI18n, RegisteredLocale, RegisteredMessages } from './index.js'
import { getDirection } from './locale.js'
import type { Formatter, I18n, I18nSnapshot, MessageAt, MessageKey, Messages, Namespace, RichValuesOf, Translator } from './types.js'

const I18nContext = createContext<I18n<string, unknown> | null>(null)
I18nContext.displayName = 'I18nContext'

export interface I18nProviderProps {
	i18n: I18n<any, any>
	/**
	 * Pin this subtree to a locale, e.g. from a Next.js `[lang]` route segment. The provider then works on its own
	 * copy of the instance, so concurrent server requests never share an active locale. Change it by navigating.
	 */
	locale?: string | undefined
	/** Messages already loaded elsewhere (e.g. on the server) to seed the cache, so the client needn't fetch them. */
	messages?: { readonly [L in RegisteredLocale]?: Messages } | undefined
	/** Run the instance's detectors after mount. Ignored when `locale` is set. Default `true`. */
	detect?: boolean | undefined
	/** Keep `<html lang dir>` in sync with the active locale. Default `true`. */
	syncDocument?: boolean | undefined
	children?: ReactNode
}

/**
 * Makes an i18n instance available to the hooks below. Suspends until the initial locale's messages are loaded,
 * so wrap it in `<Suspense>` when any locale is lazy.
 *
 * @example
 * ```tsx
 * <Suspense fallback={null}>
 *   <I18nProvider i18n={i18n}>
 *     <App />
 *   </I18nProvider>
 * </Suspense>
 *
 * // Next.js App Router: in a 'use client' file rendered by app/[lang]/layout.tsx
 * <I18nProvider i18n={i18n} locale={lang}>{children}</I18nProvider>
 * ```
 */
export const I18nProvider = ({ i18n, locale, messages, detect = true, syncDocument = true, children }: I18nProviderProps) => {
	if (messages) {
		for (const [key, value] of Object.entries(messages)) {
			if (value && !i18n.getMessages(key)) i18n.addMessages(key, value)
		}
	}
	const instance = useMemo(() => (locale === undefined ? i18n : i18n.clone({ locale })), [i18n, locale])
	const { locale: active } = useSnapshot(instance)
	if (!instance.isReady) use(instance.ready)

	// Detection reads browser-only state, so it runs after hydration: the server and client render the same markup.
	useLayoutEffect(() => {
		if (detect && locale === undefined) instance.detect().catch(console.error)
	}, [instance, detect, locale])

	useLayoutEffect(() => {
		if (!syncDocument) return
		document.documentElement.lang = active
		document.documentElement.dir = getDirection(active)
	}, [active, syncDocument])

	return <I18nContext value={instance}>{children}</I18nContext>
}

const useInstance = (hook: string): RegisteredI18n => {
	const instance = use(I18nContext)
	if (!instance) throw new Error(`[i18next-lite] ${hook}() must be used inside <I18nProvider>.`)
	return instance as unknown as RegisteredI18n
}

const useSnapshot = <L extends string>(instance: I18n<L, any>): I18nSnapshot<L> =>
	useSyncExternalStore(instance.subscribe, instance.getSnapshot, instance.getSnapshot)

type Scoped<N> = N extends string ? MessageAt<RegisteredMessages, N> : RegisteredMessages

/**
 * A translator for the active locale. Re-renders only when the locale changes, and its identity is stable per
 * locale, so it is safe in dependency arrays. Pass a namespace to scope keys: `useTranslator('settings')('title')`.
 *
 * @example
 * ```tsx
 * const translate = useTranslator()
 * translate('greeting', { name: 'Ada' })
 * translate.rich('terms', { link: <a href="/terms" /> })
 *
 * const translateSettings = useTranslator('settings')
 * translateSettings('title') // same as translate('settings.title')
 * ```
 */
export const useTranslator = <N extends Namespace<RegisteredMessages> | undefined = undefined>(namespace?: N): Translator<Scoped<N>> => {
	const instance = useInstance('useTranslator')
	const { locale } = useSnapshot(instance)
	return instance.translator(locale, namespace as never) as Translator<Scoped<N>>
}

/**
 * Locale state and controls, e.g. for a language switcher. Under a provider with a pinned `locale` (e.g. a Next.js
 * `[lang]` route), switch by navigating to the other locale's URL instead of calling `setLocale`.
 *
 * @example
 * ```tsx
 * const { locale, locales, setLocale, isPending } = useI18n()
 *
 * <select value={locale} disabled={isPending} onChange={event => setLocale(event.target.value)}>
 *   {locales.map(option => <option key={option}>{option}</option>)}
 * </select>
 * ```
 */
export const useI18n = () => {
	const instance = useInstance('useI18n')
	const snapshot = useSnapshot(instance)
	return useMemo(
		() => ({
			locale: snapshot.locale,
			/** A locale being loaded by `setLocale`; the current one stays on screen until it is ready. */
			pendingLocale: snapshot.pendingLocale,
			isPending: snapshot.pendingLocale !== undefined,
			locales: instance.locales,
			defaultLocale: instance.defaultLocale,
			dir: getDirection(snapshot.locale),
			setLocale: instance.setLocale,
			i18n: instance
		}),
		[instance, snapshot]
	)
}

/**
 * `Intl` formatters (number, date, relative time, list, display names) for the active locale.
 *
 * @example
 * ```tsx
 * const format = useFormat()
 * format.number(0.25, { style: 'percent' }) // '25%'
 * format.date(post.createdAt, { dateStyle: 'medium' })
 * ```
 */
export const useFormat = (): Formatter => {
	const instance = useInstance('useFormat')
	const { locale } = useSnapshot(instance)
	return instance.formatter(locale)
}

type Key = MessageKey<RegisteredMessages>
type TranslateValues<K extends Key> = RichValuesOf<MessageAt<RegisteredMessages, K>>

export type TranslateProps<K extends Key> = { i18nKey: K } & ({} extends TranslateValues<K>
	? { values?: TranslateValues<K> | undefined }
	: { values: TranslateValues<K> })

/**
 * Renders a message with React elements in it. The component form of `translate.rich`.
 *
 * @example
 * ```tsx
 * // "Read the <link>terms</link>, {name}."
 * <Translate i18nKey="terms" values={{ name: <b>Ada</b>, link: <a href="/terms" /> }} />
 * <Translate i18nKey="terms" values={{ name: 'Ada', link: chunks => <a href="/terms">{chunks}</a> }} />
 * ```
 */
export const Translate = <K extends Key>({ i18nKey, values }: TranslateProps<K>): ReactNode =>
	(useTranslator() as unknown as Translator<Messages>).rich(i18nKey, values as never)
