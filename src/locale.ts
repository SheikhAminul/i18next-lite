const normalize = (locale: string) => locale.trim().replace(/_/g, '-').toLowerCase()

// Normalized once per list of available locales, not on every match (e.g. once per server request).
const normalizedLists = new WeakMap<readonly string[], readonly string[]>()
const normalizeAll = (locales: readonly string[]) => {
	let normalized = normalizedLists.get(locales)
	if (!normalized) normalizedLists.set(locales, (normalized = locales.map(normalize)))
	return normalized
}

/**
 * Best match for `requested` among `available`, following the BCP 47 lookup algorithm.
 * Each preference is tried in order: exact match, then dropping subtags (`zh-Hant-TW` → `zh-Hant` → `zh`),
 * then any available locale with the same language (`en` → `en-US`).
 */
export const matchLocale = <L extends string>(
	requested: string | readonly string[] | null | undefined,
	available: readonly L[]
): L | undefined => {
	if (!requested) return undefined
	const preferences = typeof requested === 'string' ? [requested] : requested
	const normalized = normalizeAll(available)

	for (const preference of preferences) {
		if (!preference) continue
		const parts = normalize(preference).split('-')
		for (let length = parts.length; length > 0; length--) {
			const index = normalized.indexOf(parts.slice(0, length).join('-'))
			if (index !== -1) return available[index]
		}
		const index = normalized.findIndex(locale => locale.split('-')[0] === parts[0])
		if (index !== -1) return available[index]
	}
	return undefined
}

/** Locales from an `Accept-Language` header, most preferred first. */
export const parseAcceptLanguage = (header: string | null | undefined): string[] => {
	if (!header) return []
	return header
		.split(',')
		.map((part, index) => {
			const [tag = '', ...params] = part.trim().split(';')
			const q = params.map(param => param.trim()).find(param => param.startsWith('q='))
			return { tag: tag.trim(), quality: q ? Number(q.slice(2)) : 1, index }
		})
		.filter(({ tag, quality }) => tag && tag !== '*' && quality > 0 && !Number.isNaN(quality))
		.sort((a, b) => b.quality - a.quality || a.index - b.index)
		.map(({ tag }) => tag)
}

/** Best registered locale for an `Accept-Language` header, or `fallback`. Handy in Next.js `proxy.ts`/middleware. */
export const negotiateLocale = <L extends string>(acceptLanguage: string | null | undefined, available: readonly L[], fallback: L): L =>
	matchLocale(parseAcceptLanguage(acceptLanguage), available) ?? fallback

const RTL_LANGUAGES = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'iw', 'ks', 'nqo', 'ps', 'sd', 'syr', 'ug', 'ur', 'yi'])
const RTL_SCRIPTS = new Set(['adlm', 'arab', 'hebr', 'nkoo', 'rohg', 'syrc', 'thaa'])

/**
 * Text direction of a locale. Uses a fixed table rather than `Intl.Locale#getTextInfo`
 * (not available in every engine) so server and client always agree.
 */
export const getDirection = (locale: string): 'ltr' | 'rtl' => {
	const [language = '', ...subtags] = normalize(locale).split('-')
	const script = subtags.find(subtag => subtag.length === 4 && /^[a-z]+$/.test(subtag))
	if (script) return RTL_SCRIPTS.has(script) ? 'rtl' : 'ltr'
	return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr'
}
