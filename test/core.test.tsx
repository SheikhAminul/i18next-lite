import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n, storageDetector, type Translator } from '../src/index.js'
import { createTestI18n, deferred } from './fixtures/i18n.js'

const loose = (t: unknown) => t as Translator

afterEach(() => {
	vi.restoreAllMocks()
	localStorage.clear()
})

describe('createI18n', () => {
	it('exposes locales and starts on the default locale', () => {
		const i18n = createTestI18n()
		expect(i18n.locales).toEqual(['en', 'ar', 'bn', 'bn-BD'])
		expect(i18n.defaultLocale).toBe('en')
		expect(i18n.locale).toBe('en')
		expect(i18n.isReady).toBe(true)
	})

	it('starts on the best match for `locale`', () => {
		expect(createTestI18n({ locale: 'ar-EG' }).locale).toBe('ar')
		expect(createTestI18n({ locale: 'fr' }).locale).toBe('en')
	})

	it('rejects a defaultLocale that is not registered', () => {
		expect(() => createI18n({ defaultLocale: 'fr' as 'en', locales: { en: {} } })).toThrow(/defaultLocale "fr"/)
	})
})

describe('translate', () => {
	const { t } = createTestI18n()

	it('looks up plain and nested keys', () => {
		expect(t('plain')).toBe('Plain text')
		expect(t('home.title')).toBe('Welcome')
		expect(t('home.nested.deep', { value: 'x' })).toBe('Deep x')
	})

	it('interpolates params and leaves unknown ones visible', () => {
		expect(t('greeting', { name: 'Ada' })).toBe('Hello, Ada!')
		expect(loose(t)('greeting')).toBe('Hello, {name}!')
	})

	it('formats number, bigint and date params for the locale', async () => {
		expect(t('total', { amount: 1234567.5 })).toBe('Total: 1,234,567.5')
		expect(t('total', { amount: 10n ** 12n })).toBe('Total: 1,000,000,000,000')
		expect(t('total', { amount: new Date(Date.UTC(2026, 0, 15, 12)) })).toMatch(/^Total: 1\/15\/2026$/)

		const bn = await createTestI18n().getT('bn')
		expect(bn('total', { amount: 1234 })).toBe('মোট: ১,২৩৪')
	})

	it('strips rich-text tags in plain strings', () => {
		expect(t('terms')).toBe('Read the terms and agree.')
		expect(t('lines')).toBe('OneTwo')
	})

	it('picks plural forms with Intl.PluralRules, honouring `zero`', async () => {
		expect(t('inbox', { count: 0 })).toBe('No messages')
		expect(t('inbox', { count: 1 })).toBe('You have 1 message')
		expect(t('inbox', { count: 1000 })).toBe('You have 1,000 messages')
		expect(loose(t)('inbox')).toBe('You have {count} messages')

		const ar = await createTestI18n().getT('ar')
		expect([0, 1, 2, 3, 11, 100].map(count => ar('inbox', { count }))).toEqual([
			'لا رسائل',
			'رسالة واحدة',
			'رسالتان',
			'3 رسائل',
			'11 رسالة',
			'100 رسالة'
		])
	})

	it('accepts a bigint count', async () => {
		const i18n = createTestI18n()
		expect(i18n.t('inbox', { count: 1n })).toBe('You have 1 message')
		expect(i18n.t('inbox', { count: 0n })).toBe('No messages')
	})

	it('supports flat keys that contain dots', () => {
		const i18n = createI18n({ defaultLocale: 'en', locales: { en: { 'flat.key': 'Flat' } } })
		expect(i18n.t('flat.key')).toBe('Flat')
	})

	it('does not resolve keys from the object prototype', () => {
		expect(loose(t)('constructor')).toBe('constructor')
		expect(loose(t)('home.toString')).toBe('home.toString')
	})

	it('reports whether a key exists', () => {
		expect(t.has('home.title')).toBe(true)
		expect(t.has('home')).toBe(false)
		expect(t.has('missing')).toBe(false)
	})

	it('scopes keys to a namespace', async () => {
		const home = await createTestI18n().getT('en', 'home')
		expect(home('title')).toBe('Welcome')
		expect(home('nested.deep', { value: 1 })).toBe('Deep 1')
		expect(home.namespace).toBe('home')
		expect(home.has('title')).toBe(true)
	})

	it('returns the same translator for the same locale and namespace', () => {
		const i18n = createTestI18n()
		expect(i18n.translator('en')).toBe(i18n.translator('en'))
		expect(i18n.translator('en', 'home')).toBe(i18n.translator('en', 'home'))
		expect(i18n.translator('en')).not.toBe(i18n.translator('ar'))
	})
})

describe('missing keys and fallbacks', () => {
	it('falls back through region, base language and default locale', async () => {
		const i18n = createTestI18n()
		await i18n.setLocale('bn-BD')
		expect(i18n.t('greeting', { name: 'A' })).toBe('হ্যালো (BD), A!')
		expect(i18n.t('home.title')).toBe('স্বাগতম')
		expect(i18n.t('onlyEnglish')).toBe('Only in English')
	})

	it('formats fallback messages with the locale they came from', async () => {
		const ar = await createTestI18n().getT('ar')
		expect(loose(ar)('total', { amount: 5 })).toBe('Total: 5')
	})

	it('honours configured fallbacks before the base language', async () => {
		const i18n = createI18n({
			defaultLocale: 'en',
			fallbacks: { 'pt-BR': ['pt-PT'] },
			locales: { en: { a: 'en', b: 'en' }, pt: { a: 'pt', b: 'pt' }, 'pt-PT': { a: 'pt-PT' }, 'pt-BR': {} }
		})
		const t = await i18n.getT('pt-BR')
		expect(t('a')).toBe('pt-PT')
		expect(t('b')).toBe('pt')
	})

	it('returns the key and warns once per key in development', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const t = loose(createTestI18n().t)
		expect(t('nope')).toBe('nope')
		expect(t('nope')).toBe('nope')
		expect(warn).toHaveBeenCalledTimes(1)
		expect(warn.mock.calls[0]?.[0]).toContain('Missing message "nope" for locale "en"')
	})

	it('lets onMissingKey supply a replacement', async () => {
		const onMissingKey = vi.fn(({ key }: { key: string }) => `⚠ ${key}`)
		const home = loose(await createTestI18n({ onMissingKey }).getT('ar', 'home'))
		expect(home('nothing')).toBe('⚠ home.nothing')
		expect(onMissingKey).toHaveBeenCalledWith({ key: 'home.nothing', locale: 'ar' })
	})
})

describe('rich text', () => {
	const { t } = createTestI18n()
	const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>)

	it('renders tags with elements or functions', () => {
		const node = t.rich('terms', { link: <a href="/terms" />, b: chunks => <strong>{chunks}</strong> })
		expect(html(node)).toBe('Read the <a href="/terms">terms</a> and <strong>agree</strong>.')
	})

	it('renders self-closing tags', () => {
		expect(html(t.rich('lines', { br: <br /> }))).toBe('One<br/>Two')
	})

	it('inserts React nodes and formatted values as params', () => {
		expect(html(t.rich('greeting', { name: <em>Ada</em> }))).toBe('Hello, <em>Ada</em>!')
		expect(t.rich('total', { amount: 1500 })).toBe('Total: 1,500')
	})

	it('supports nested tags and leaves malformed ones as text', () => {
		const i18n = createI18n({
			defaultLocale: 'en',
			locales: { en: { nested: '<b>bold <i>both</i></b>', broken: 'a <b>b </i> c', stray: 'x </b> 1 < 2' } }
		})
		const b = <b />
		const i = <i />
		expect(html(i18n.t.rich('nested', { b, i }))).toBe('<b>bold <i>both</i></b>')
		expect(loose(i18n.t).rich('broken', { b, i })).toBe('a <b>b </i> c')
		expect(i18n.t.rich('stray')).toBe('x </b> 1 < 2')
	})

	it('parses whitespace and braces the way the types expect', () => {
		const i18n = createI18n({
			defaultLocale: 'en',
			locales: { en: { spaced: 'One<br />Two <b >bold</b >', text: 'Use {curly braces}, {} and a < b > c', doubled: '{{name}}', attr: '<a href>x</a>' } }
		})
		expect(html(i18n.t.rich('spaced', { br: <br />, b: <b /> }))).toBe('One<br/>Two <b>bold</b>')
		expect(i18n.t('text')).toBe('Use {curly braces}, {} and a < b > c')
		expect(i18n.t('doubled', { name: 'x' })).toBe('{x}')
		expect(i18n.t.rich('attr')).toBe('<a href>x</a>')
	})

	it('renders the content of tags without a renderer, warning once', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const t = loose(createTestI18n().t)
		expect(t.rich('terms')).toBe('Read the terms and agree.')
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('No renderer for <link>'))
	})

	it('has no key warnings with multiple element children', () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {})
		html(t.rich('terms', { link: <a />, b: <b /> }))
		expect(error).not.toHaveBeenCalled()
	})
})

describe('locale switching', () => {
	it('switches synchronously to a loaded locale and notifies subscribers', async () => {
		const i18n = createTestI18n()
		const listener = vi.fn()
		const unsubscribe = i18n.subscribe(listener)
		await i18n.setLocale('ar-SA')
		expect(i18n.locale).toBe('ar')
		expect(i18n.t('plain')).toBe('نص عادي')
		expect(listener).toHaveBeenCalledTimes(1)

		await i18n.setLocale('ar')
		expect(listener).toHaveBeenCalledTimes(1)
		unsubscribe()
		await i18n.setLocale('en')
		expect(listener).toHaveBeenCalledTimes(1)
	})

	it('keeps the current locale while a lazy one loads', async () => {
		const bn = deferred<unknown>()
		const i18n = createTestI18n({ bn: () => bn.promise })
		const switching = i18n.setLocale('bn')
		expect(i18n.getSnapshot()).toEqual({ locale: 'en', pendingLocale: 'bn' })
		expect(i18n.t('plain')).toBe('Plain text')

		bn.resolve({ default: { plain: 'সাধারণ লেখা' } })
		await switching
		expect(i18n.getSnapshot()).toEqual({ locale: 'bn', pendingLocale: undefined })
		expect(i18n.t('plain')).toBe('সাধারণ লেখা')
	})

	it('lets the latest setLocale call win', async () => {
		const bn = deferred<unknown>()
		const i18n = createTestI18n({ bn: () => bn.promise })
		const slow = i18n.setLocale('bn')
		await i18n.setLocale('ar')
		bn.resolve({ plain: 'x' })
		await slow
		expect(i18n.locale).toBe('ar')
	})

	it('loads each locale once, even when requested concurrently', async () => {
		const loader = vi.fn(() => Promise.resolve({ plain: 'x' }))
		const i18n = createTestI18n({ bn: loader })
		await Promise.all([i18n.setLocale('bn'), i18n.load('bn-BD'), i18n.clone().getT('bn')])
		expect(loader).toHaveBeenCalledTimes(1)
	})

	it('surfaces load errors, clears the pending state and allows a retry', async () => {
		let attempts = 0
		const i18n = createTestI18n({
			bn: () => (++attempts === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ plain: 'ok' }))
		})
		await expect(i18n.setLocale('bn')).rejects.toThrow('offline')
		expect(i18n.getSnapshot()).toEqual({ locale: 'en', pendingLocale: undefined })

		await i18n.setLocale('bn')
		expect(i18n.t('plain')).toBe('ok')
	})

	it('ignores unknown locales with a warning', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const i18n = createTestI18n()
		await i18n.setLocale('fr')
		expect(i18n.locale).toBe('en')
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('No registered locale matches "fr"'))
	})

	it('is not ready until a lazy initial locale is loaded', async () => {
		const i18n = createTestI18n({ locale: 'bn' })
		expect(i18n.locale).toBe('bn')
		expect(i18n.isReady).toBe(false)
		await i18n.ready
		expect(i18n.isReady).toBe(true)
		expect(i18n.t('home.title')).toBe('স্বাগতম')
	})

	it('rejects load() for unknown locales', async () => {
		await expect(createTestI18n().load('fr')).rejects.toThrow('Unknown locale "fr"')
	})
})

describe('detection', () => {
	it('uses the first detector with a registered match and persists choices', async () => {
		localStorage.setItem('locale', 'ar')
		const i18n = createTestI18n({
			detectors: [{ detect: () => 'fr' }, { detect: () => { throw new Error('boom') } }, storageDetector()]
		})
		await i18n.detect()
		expect(i18n.locale).toBe('ar')

		await i18n.setLocale('en')
		expect(localStorage.getItem('locale')).toBe('en')
	})

	it('does nothing without a match', async () => {
		const i18n = createTestI18n({ detectors: [{ detect: () => null }] })
		await i18n.detect()
		expect(i18n.locale).toBe('en')
	})
})

describe('instances', () => {
	it('clones have their own locale but share loaded messages', async () => {
		const loader = vi.fn(() => import('./fixtures/bn.json'))
		const i18n = createTestI18n({ bn: loader })
		const a = i18n.clone({ locale: 'ar' })
		const b = i18n.clone({ locale: 'bn' })
		await b.ready
		expect([i18n.locale, a.locale, b.locale]).toEqual(['en', 'ar', 'bn'])

		await a.setLocale('bn')
		expect(a.t('plain')).toBe('সাধারণ লেখা')
		expect(i18n.locale).toBe('en')
		expect(loader).toHaveBeenCalledTimes(1)
	})

	it('getT loads a locale without changing the active one', async () => {
		const i18n = createTestI18n()
		const t = await i18n.getT('bn')
		expect(t('plain')).toBe('সাধারণ লেখা')
		expect(t.locale).toBe('bn')
		expect(i18n.locale).toBe('en')
		expect((await i18n.getT('fr')).locale).toBe('en')
		expect((await i18n.getT()).locale).toBe('en')
	})

	it('accepts messages added at runtime and unwraps module namespaces', async () => {
		const i18n = createTestI18n({ bn: () => Promise.reject(new Error('should not load')) })
		i18n.addMessages('bn', { plain: 'added' })
		expect(i18n.getMessages('bn')).toEqual({ plain: 'added' })
		expect((await i18n.getT('bn'))('plain')).toBe('added')

		const json = createTestI18n({ bn: () => import('./fixtures/bn.json') })
		await json.load('bn')
		expect(json.getMessages('bn')).toHaveProperty('plain', 'সাধারণ লেখা')
	})

	it('keeps messages added while a loader is in flight', async () => {
		const bn = deferred<unknown>()
		const i18n = createTestI18n({ bn: () => bn.promise })
		const loading = i18n.load('bn')
		i18n.addMessages('bn', { plain: 'added' })
		bn.resolve({ default: { plain: 'loaded' } })
		await loading
		expect(i18n.getMessages('bn')).toEqual({ plain: 'added' })
	})

	it('notifies subscribers when loaded messages are replaced, not when a locale is added', async () => {
		const i18n = createTestI18n()
		const clone = i18n.clone()
		const listener = vi.fn()
		const cloneListener = vi.fn()
		const unsubscribe = i18n.subscribe(listener)
		const unsubscribeClone = clone.subscribe(cloneListener)

		i18n.addMessages('bn', { plain: 'added' })
		expect(listener).not.toHaveBeenCalled()

		const before = i18n.getSnapshot()
		i18n.addMessages('en', { plain: 'Replaced' })
		expect(listener).toHaveBeenCalledOnce()
		expect(cloneListener).toHaveBeenCalledOnce()
		expect(i18n.getSnapshot()).not.toBe(before)
		expect(i18n.getSnapshot()).toEqual(before)
		expect(loose(i18n.t)('plain')).toBe('Replaced')

		unsubscribe()
		unsubscribeClone()
		i18n.addMessages('en', { plain: 'Again' })
		expect(listener).toHaveBeenCalledOnce()
		expect(cloneListener).toHaveBeenCalledOnce()
	})

	it('never serves stale lookups after messages change', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		const i18n = createTestI18n()
		const bn = i18n.translator('bn')
		expect(bn('home.title')).toBe('Welcome')
		expect(loose(bn)('onlyBangla')).toBe('onlyBangla')

		await i18n.load('bn')
		expect(bn('home.title')).toBe('স্বাগতম')

		i18n.addMessages('bn', { onlyBangla: 'শুধু বাংলা' })
		expect(loose(bn)('onlyBangla')).toBe('শুধু বাংলা')
		expect(bn('home.title')).toBe('Welcome')
	})

	it('formats with Intl for the active locale', async () => {
		const i18n = createTestI18n()
		expect(i18n.format.number(1234.5)).toBe('1,234.5')
		expect(i18n.format.number(0.25, { style: 'percent' })).toBe('25%')
		expect(i18n.format.list(['a', 'b', 'c'])).toBe('a, b, and c')
		expect(i18n.format.relativeTime(-1, 'day', { numeric: 'auto' })).toBe('yesterday')
		expect(i18n.format.displayName('bn', { type: 'language' })).toBe('Bangla')
		expect(i18n.format.date('2026-01-15T12:00:00Z', { timeZone: 'UTC', dateStyle: 'long' })).toBe('January 15, 2026')

		await i18n.setLocale('bn')
		expect(i18n.format.number(1234.5)).toBe('১,২৩৪.৫')
		expect(i18n.format).toBe(i18n.formatter('bn'))
	})
})
