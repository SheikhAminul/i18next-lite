import type { Formatter, ParamValue } from './types.js'

// Intl constructors are slow, so instances are reused: per locale for the default options used by
// interpolation (no key building on the hot path), and per locale + options for explicit formatting.
const defaults = { number: new Map<string, Intl.NumberFormat>(), date: new Map<string, Intl.DateTimeFormat>(), plural: new Map<string, Intl.PluralRules>() }
const withOptions = new Map<string, unknown>()

const reuse = <T>(cache: Map<string, T>, key: string, create: () => T): T => {
	let instance = cache.get(key)
	if (instance === undefined) cache.set(key, (instance = create()))
	return instance
}

const configured = <T>(kind: string, locale: string, options: object, create: () => T): T =>
	reuse(withOptions as Map<string, T>, `${kind}\0${locale}\0${JSON.stringify(options)}`, create)

const numberFormat = (locale: string, options?: Intl.NumberFormatOptions) =>
	options
		? configured('number', locale, options, () => new Intl.NumberFormat(locale, options))
		: reuse(defaults.number, locale, () => new Intl.NumberFormat(locale))

const dateFormat = (locale: string, options?: Intl.DateTimeFormatOptions) =>
	options
		? configured('date', locale, options, () => new Intl.DateTimeFormat(locale, options))
		: reuse(defaults.date, locale, () => new Intl.DateTimeFormat(locale))

export const pluralRules = (locale: string) => reuse(defaults.plural, locale, () => new Intl.PluralRules(locale))

export const formatValue = (locale: string, value: ParamValue): string =>
	typeof value === 'string' ? value : value instanceof Date ? dateFormat(locale).format(value) : numberFormat(locale).format(value)

export const createFormatter = (locale: string): Formatter => ({
	locale,
	number: (value, options) => numberFormat(locale, options).format(value),
	date: (value, options) => dateFormat(locale, options).format(typeof value === 'string' ? new Date(value) : value),
	relativeTime: (value, unit, options = {}) =>
		configured('relative', locale, options, () => new Intl.RelativeTimeFormat(locale, options)).format(value, unit),
	list: (items, options = {}) => configured('list', locale, options, () => new Intl.ListFormat(locale, options)).format(items),
	displayName: (code, options) => configured('display', locale, options, () => new Intl.DisplayNames(locale, options)).of(code)
})
