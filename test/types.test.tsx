// Type-level tests: `npm run typecheck` fails if any assertion or `@ts-expect-error` is wrong.
import { describe, expectTypeOf, it } from 'vitest'
import { createI18n, type MessageKey, type Messages, type Namespace, type Translator } from '../src/index.js'
import { Trans, useI18n, useT } from '../src/react.js'
import { createTestI18n } from './fixtures/i18n.js'
import { en } from './fixtures/messages.js'

describe('types', () => {
	const i18n = createTestI18n()
	const { t } = i18n

	it('infers locales from the config', () => {
		expectTypeOf(i18n.locales).toEqualTypeOf<readonly ('en' | 'ar' | 'bn' | 'bn-BD')[]>()
		expectTypeOf(i18n.locale).toEqualTypeOf<'en' | 'ar' | 'bn' | 'bn-BD'>()
		expectTypeOf(i18n.match).returns.toEqualTypeOf<'en' | 'ar' | 'bn' | 'bn-BD' | undefined>()
	})

	it('infers keys and namespaces from the default locale', () => {
		expectTypeOf<MessageKey<typeof en>>().toEqualTypeOf<
			'plain' | 'greeting' | 'inbox' | 'home.title' | 'home.subtitle' | 'home.nested.deep' | 'terms' | 'lines' | 'total' | 'onlyEnglish'
		>()
		expectTypeOf<Namespace<typeof en>>().toEqualTypeOf<'home' | 'home.nested'>()

		// @ts-expect-error unknown key
		t('nope')
		// @ts-expect-error a namespace is not a message
		t('home')
	})

	it('checks params', () => {
		t('plain')
		t('greeting', { name: 'Ada' })
		t('total', { amount: 1 })
		t('total', { amount: new Date() })
		t('home.nested.deep', { value: 10n })

		// @ts-expect-error missing params
		t('greeting')
		// @ts-expect-error misspelled param
		t('greeting', { nam: 'Ada' })
		// @ts-expect-error params must be strings, numbers, bigints or dates
		t('greeting', { name: { first: 'Ada' } })
	})

	it('requires a numeric count for plurals', () => {
		t('inbox', { count: 2 })
		// @ts-expect-error count is required
		t('inbox')
		t('inbox', { count: 2n })
		// @ts-expect-error count must be a number
		t('inbox', { count: '2' })
	})

	it('types params and tags exactly as the parser reads them', () => {
		const { t } = createI18n({
			defaultLocale: 'en',
			locales: {
				en: {
					unread: 'You have {count} unread',
					spaced: 'One<br />Two <b >bold</b >',
					text: 'Use {curly braces}, {} and a < b > c',
					doubled: '{{name}}',
					attr: '<a href>x</a>'
				}
			}
		})
		t('unread', { count: 2 })
		// @ts-expect-error {count} is an ordinary, required param outside plurals
		t('unread')
		t.rich('spaced', { br: <br />, b: <b /> })
		// @ts-expect-error renderers are keyed by the bare tag name
		t.rich('spaced', { 'br ': <br />, b: <b /> })
		t('text')
		t.rich('attr')
		t('doubled', { name: 'x' })
		// @ts-expect-error `{{name}}` is the param `name`
		t('doubled', { '{name': 'x' })
	})

	it('types rich text values and tag renderers', () => {
		expectTypeOf(t.rich('plain')).toEqualTypeOf<React.ReactNode>()
		t.rich('terms', { link: <a href="/terms" />, b: chunks => <b>{chunks}</b> })
		t.rich('greeting', { name: <em>Ada</em> })
		t.rich('lines', { br: <br /> })

		// @ts-expect-error missing the <b> renderer
		t.rich('terms', { link: <a /> })
	})

	it('scopes namespaced translators', async () => {
		const home = await i18n.getT('bn', 'home')
		expectTypeOf(home).toEqualTypeOf<Translator<(typeof en)['home']>>()
		home('subtitle', { user: 'ada' })
		home('nested.deep', { value: 1 })
		// @ts-expect-error keys are relative to the namespace
		home('home.title')
		// @ts-expect-error not a namespace
		void i18n.getT('bn', 'home.title')
	})

	it('accepts any string key for JSON or untyped messages', async () => {
		const json = createI18n({ defaultLocale: 'en', locales: { en: () => import('./fixtures/bn.json') } })
		const tj = await json.getT()
		tj('home.title')
		tj('greeting', { name: 'x' })
		// @ts-expect-error JSON still gives typed keys
		tj('nope')

		const untyped = createI18n({ defaultLocale: 'en', locales: { en: {} as Messages } })
		untyped.t('anything')
		untyped.t('anything', { any: 1 })
		untyped.t.rich('anything', { b: <b /> })
	})

	it('types the React hooks via Register', () => {
		const Component = () => {
			const t = useT()
			const home = useT('home')
			const { locale, setLocale } = useI18n()
			expectTypeOf(locale).toEqualTypeOf<'en' | 'ar' | 'bn' | 'bn-BD'>()
			void setLocale('bn')
			// @ts-expect-error unknown namespace
			useT('nope')
			return (
				<>
					{t('greeting', { name: 'Ada' })}
					{home('title')}
					<Trans i18nKey="plain" />
					<Trans i18nKey="terms" values={{ link: <a />, b: <b /> }} />
					{/* @ts-expect-error values are required for this key */}
					<Trans i18nKey="terms" />
					{/* @ts-expect-error unknown key */}
					<Trans i18nKey="nope" />
				</>
			)
		}
		expectTypeOf(Component).toBeFunction()
	})
})
