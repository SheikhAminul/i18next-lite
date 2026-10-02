import { createFormatter } from './format.js'
import { matchLocale } from './locale.js'
import { compile, isPluralMessage, pluralCategory, renderRich, renderString, toNode, type Compiled } from './message.js'
import type {
	Formatter,
	I18n,
	I18nSnapshot,
	LocaleDetector,
	LocaleSource,
	Messages,
	MessagesOf,
	MissingKeyInfo,
	PluralCategory,
	PluralMessage,
	Translator
} from './types.js'

declare const process: { env: { NODE_ENV?: string } }
const isDev = (() => {
	try {
		return process.env.NODE_ENV !== 'production'
	} catch {
		return false
	}
})()

export interface I18nConfig<Locales extends Record<string, LocaleSource>, D extends keyof Locales & string> {
	/** Messages per locale: an object, or a loader such as `() => import('./locales/bn.json')`. */
	locales: Locales
	/** The final fallback for every locale. Its messages define the keys and params you get type-checked. */
	defaultLocale: D
	/** The initial locale (best match). Defaults to `defaultLocale`. */
	locale?: string | undefined
	/** Extra fallbacks per locale, tried before the base language and `defaultLocale`. E.g. `{ 'pt-BR': ['pt-PT'] }`. */
	fallbacks?: { readonly [K in keyof Locales]?: readonly (keyof Locales & string)[] } | undefined
	/** Where `detect()` looks for a preferred locale, in order. Detectors with `persist` remember `setLocale` choices. */
	detectors?: readonly LocaleDetector[] | undefined
	/** Called when a key is missing from a locale and all its fallbacks. Return a string to render instead of the key. */
	onMissingKey?: ((info: MissingKeyInfo) => string | void) | undefined
}

interface Shared {
	readonly config: I18nConfig<Record<string, LocaleSource>, string>
	readonly locales: readonly string[]
	readonly loaded: Map<string, Messages>
	readonly loading: Map<string, Promise<void>>
	readonly chains: Map<string, readonly string[]>
	/** locale → namespace ('' for none) → translator */
	readonly translators: Map<string, Map<string, Translator>>
	readonly formatters: Map<string, Formatter>
	readonly warned: Set<string>
	/** Bumped whenever messages change, invalidating translators' lookup memos. */
	version: number
}

/** A resolved key: where it was found, and its message compiled once (plural forms on first use). */
type Entry =
	| { readonly locale: string; readonly message: Compiled; readonly plural?: undefined }
	| { readonly locale: string; readonly plural: PluralMessage; readonly forms: { [C in PluralCategory]?: Compiled } }

type Values = Readonly<Record<string, unknown>> | undefined

const warnOnce = (shared: Shared, id: string, message: string) => {
	if (!isDev || shared.warned.has(id)) return
	shared.warned.add(id)
	console.warn(`[i18next-lite] ${message}`)
}

/** `locale`, its configured fallbacks, its base language, then the default locale. */
const chainOf = (shared: Shared, locale: string): readonly string[] => {
	let chain = shared.chains.get(locale)
	if (!chain) {
		const { fallbacks, defaultLocale } = shared.config
		const base = locale.split('-')[0]!.toLowerCase()
		const baseLocale = shared.locales.find(candidate => candidate.toLowerCase() === base)
		chain = [...new Set([locale, ...(fallbacks?.[locale] ?? []), ...(baseLocale ? [baseLocale] : []), defaultLocale])]
		shared.chains.set(locale, chain)
	}
	return chain
}

const isLoaded = (shared: Shared, locale: string) => chainOf(shared, locale).every(entry => shared.loaded.has(entry))

const setMessages = (shared: Shared, locale: string, messages: Messages) => {
	shared.loaded.set(locale, messages)
	shared.version++
}

/** Accepts `import('./x.json')` namespaces as well as plain message objects. */
const unwrapModule = (module: unknown): Messages => {
	const value = module as { default?: unknown; __esModule?: unknown; [Symbol.toStringTag]?: unknown }
	const isNamespace = value[Symbol.toStringTag] === 'Module' || value.__esModule === true || Object.keys(value).join() === 'default'
	return (isNamespace && typeof value.default === 'object' && value.default ? value.default : value) as Messages
}

const loadOne = (shared: Shared, locale: string): Promise<void> => {
	let pending = shared.loading.get(locale)
	if (!pending) {
		const source = shared.config.locales[locale] as () => Promise<unknown>
		pending = Promise.resolve()
			.then(source)
			.then(module => setMessages(shared, locale, unwrapModule(module)))
			.finally(() => shared.loading.delete(locale))
		shared.loading.set(locale, pending)
	}
	return pending
}

const RESOLVED = Promise.resolve()

const load = (shared: Shared, locale: string): Promise<void> => {
	const missing = chainOf(shared, locale).filter(entry => !shared.loaded.has(entry))
	return missing.length ? Promise.all(missing.map(entry => loadOne(shared, entry))).then(() => {}) : RESOLVED
}

const getPath = (messages: Messages | undefined, key: string): unknown => {
	if (!messages) return undefined
	if (Object.hasOwn(messages, key)) return messages[key]
	let node: unknown = messages
	for (const part of key.split('.')) {
		if (typeof node !== 'object' || node === null || !Object.hasOwn(node, part)) return undefined
		node = (node as Messages)[part]
	}
	return node
}

const lookup = (shared: Shared, locale: string, key: string): Entry | undefined => {
	for (const entry of chainOf(shared, locale)) {
		const value = getPath(shared.loaded.get(entry), key)
		if (typeof value === 'string') return { locale: entry, message: compile(value) }
		if (isPluralMessage(value)) return { locale: entry, plural: value, forms: {} }
	}
	return undefined
}

const select = (entry: Entry, count: unknown): Compiled => {
	if (!entry.plural) return entry.message
	const category = pluralCategory(entry.plural, entry.locale, count)
	return (entry.forms[category] ??= compile(entry.plural[category]!))
}

const createTranslator = (shared: Shared, locale: string, namespace: string | undefined): Translator => {
	const fullKey = (key: string) => (namespace ? `${namespace}.${key}` : key)

	// Each key is resolved through the fallback chain once, then served from this memo until messages change.
	const memo = new Map<string, Entry | null>()
	let version = shared.version
	const resolve = (key: string) => {
		if (version !== shared.version) {
			memo.clear()
			version = shared.version
		}
		let entry = memo.get(key)
		if (entry === undefined) memo.set(key, (entry = lookup(shared, locale, fullKey(key)) ?? null))
		return entry
	}

	const missing = (key: string) => {
		const info = { key: fullKey(key), locale }
		const replacement = shared.config.onMissingKey?.(info)
		if (typeof replacement === 'string') return replacement
		warnOnce(shared, `key\0${locale}\0${info.key}`, `Missing message "${info.key}" for locale "${locale}".`)
		return info.key
	}

	const t = (key: string, params?: Values) => {
		const entry = resolve(key)
		if (!entry) return missing(key)
		const message = select(entry, params?.count)
		return typeof message === 'string' ? message : renderString(message, entry.locale, params)
	}
	t.rich = (key: string, values?: Values) => {
		const entry = resolve(key)
		if (!entry) return missing(key)
		const message = select(entry, values?.count)
		if (typeof message === 'string') return message
		const onMissingTag = (tag: string) =>
			warnOnce(shared, `tag\0${fullKey(key)}\0${tag}`, `No renderer for <${tag}> in message "${fullKey(key)}".`)
		return toNode(renderRich(message, entry.locale, values, onMissingTag))
	}
	t.has = (key: string) => resolve(key) !== null
	t.locale = locale
	t.namespace = namespace
	return t as unknown as Translator
}

const getTranslator = (shared: Shared, locale: string, namespace?: string): Translator => {
	let byNamespace = shared.translators.get(locale)
	if (!byNamespace) shared.translators.set(locale, (byNamespace = new Map()))
	let translator = byNamespace.get(namespace ?? '')
	if (!translator) byNamespace.set(namespace ?? '', (translator = createTranslator(shared, locale, namespace)))
	return translator
}

const getFormatter = (shared: Shared, locale: string): Formatter => {
	let formatter = shared.formatters.get(locale)
	if (!formatter) shared.formatters.set(locale, (formatter = createFormatter(locale)))
	return formatter
}

const createInstance = (shared: Shared, requested: string | undefined): I18n => {
	const { config, locales } = shared
	const match = (preference: string | readonly string[] | null | undefined) => matchLocale(preference, locales)

	let snapshot: I18nSnapshot = { locale: match(requested) ?? config.defaultLocale, pendingLocale: undefined }
	const listeners = new Set<() => void>()
	let latestRequest = 0

	const update = (next: I18nSnapshot) => {
		if (next.locale === snapshot.locale && next.pendingLocale === snapshot.pendingLocale) return
		snapshot = next
		for (const listener of listeners) listener()
	}
	const commit = (locale: string) => {
		update({ locale, pendingLocale: undefined })
		for (const detector of config.detectors ?? []) detector.persist?.(locale)
	}

	const ready = load(shared, snapshot.locale)
	// Rejections surface through `ready` and the React provider; don't also report them as unhandled.
	ready.catch(() => {})

	const setLocale = (preference: string | readonly string[]): Promise<void> => {
		const next = match(preference)
		if (!next) {
			warnOnce(shared, `locale\0${String(preference)}`, `No registered locale matches "${String(preference)}".`)
			return RESOLVED
		}
		const request = ++latestRequest
		if (isLoaded(shared, next)) {
			commit(next)
			return RESOLVED
		}
		update({ locale: snapshot.locale, pendingLocale: next })
		return load(shared, next).then(
			() => {
				if (request === latestRequest) commit(next)
			},
			error => {
				if (request === latestRequest) update({ locale: snapshot.locale, pendingLocale: undefined })
				throw error
			}
		)
	}

	return {
		locales,
		defaultLocale: config.defaultLocale,
		ready,
		get locale() {
			return snapshot.locale
		},
		get t() {
			return getTranslator(shared, snapshot.locale)
		},
		get format() {
			return getFormatter(shared, snapshot.locale)
		},
		get isReady() {
			return isLoaded(shared, snapshot.locale)
		},
		setLocale,
		detect: () => {
			for (const detector of config.detectors ?? []) {
				let detected
				try {
					detected = match(detector.detect())
				} catch {}
				if (detected) return setLocale(detected)
			}
			return RESOLVED
		},
		match,
		load: locale => {
			const matched = match(locale)
			return matched ? load(shared, matched) : Promise.reject(new Error(`[i18next-lite] Unknown locale "${locale}".`))
		},
		addMessages: (locale, messages) => setMessages(shared, locale, messages),
		getMessages: locale => shared.loaded.get(locale),
		getT: (locale, namespace) => {
			const resolved = locale === undefined ? snapshot.locale : (match(locale) ?? config.defaultLocale)
			return load(shared, resolved).then(() => getTranslator(shared, resolved, namespace) as never)
		},
		translator: (locale, namespace) => getTranslator(shared, locale, namespace) as never,
		formatter: locale => getFormatter(shared, locale),
		clone: options => createInstance(shared, options?.locale ?? snapshot.locale),
		subscribe: listener => {
			listeners.add(listener)
			return () => void listeners.delete(listener)
		},
		getSnapshot: () => snapshot
	}
}

/**
 * Create an i18n instance.
 *
 * ```ts
 * export const i18n = createI18n({
 *   defaultLocale: 'en',
 *   locales: { en, bn: () => import('./locales/bn.json') }
 * })
 * ```
 */
export const createI18n = <const Locales extends Record<string, LocaleSource>, D extends keyof Locales & string>(
	config: I18nConfig<Locales, D>
): I18n<keyof Locales & string, MessagesOf<Locales[D]>> => {
	const locales = Object.keys(config.locales)
	if (!locales.includes(config.defaultLocale)) {
		throw new Error(`[i18next-lite] defaultLocale "${config.defaultLocale}" is not one of: ${locales.join(', ')}.`)
	}
	const shared: Shared = {
		config: config as unknown as Shared['config'],
		locales,
		loaded: new Map(),
		loading: new Map(),
		chains: new Map(),
		translators: new Map(),
		formatters: new Map(),
		warned: new Set(),
		version: 0
	}
	for (const locale of locales) {
		const source = config.locales[locale]
		if (typeof source === 'object') shared.loaded.set(locale, source)
	}
	return createInstance(shared, config.locale) as unknown as I18n<keyof Locales & string, MessagesOf<Locales[D]>>
}
