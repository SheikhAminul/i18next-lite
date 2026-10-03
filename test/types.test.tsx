// Type-level tests: `npm run typecheck` fails if any assertion or `@ts-expect-error` is wrong.
import { describe, expectTypeOf, it } from 'vitest'
import { createI18n, type MessageKey, type Messages, type Namespace, type Translator } from '../src/index.js'
import { Translate, useI18n, useTranslator } from '../src/react.js'
import { createTestI18n } from './fixtures/i18n.js'
import { en } from './fixtures/messages.js'
import sourceText from './fixtures/source-text.json' with { type: 'json' }

describe('types', () => {
	const i18n = createTestI18n()
	const { translate } = i18n

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
		translate('nope')
		// @ts-expect-error a namespace is not a message
		translate('home')
	})

	it('checks params', () => {
		translate('plain')
		translate('greeting', { name: 'Ada' })
		translate('total', { amount: 1 })
		translate('total', { amount: new Date() })
		translate('home.nested.deep', { value: 10n })

		// @ts-expect-error missing params
		translate('greeting')
		// @ts-expect-error misspelled param
		translate('greeting', { nam: 'Ada' })
		// @ts-expect-error params must be strings, numbers, bigints or dates
		translate('greeting', { name: { first: 'Ada' } })
	})

	it('requires a numeric count for plurals', () => {
		translate('inbox', { count: 2 })
		// @ts-expect-error count is required
		translate('inbox')
		translate('inbox', { count: 2n })
		// @ts-expect-error count must be a number
		translate('inbox', { count: '2' })
	})

	it('types params and tags exactly as the parser reads them', () => {
		const { translate } = createI18n({
			defaultLocale: 'en',
			locales: {
				en: {
					unread: 'You have {count} unread',
					spaced: 'One<br />Two <b >bold</b >',
					text: 'Use {curly braces}, {} and a < b > c',
					doubled: '{{name}}',
					attr: '<a href>x</a>',
					names: '<a.b>x</a.b> <é>y</é> <h1>z</h1> <my-tag_2>w</my-tag_2>'
				}
			}
		})
		translate('unread', { count: 2 })
		// @ts-expect-error {count} is an ordinary, required param outside plurals
		translate('unread')
		translate.rich('spaced', { br: <br />, b: <b /> })
		// @ts-expect-error renderers are keyed by the bare tag name
		translate.rich('spaced', { 'br ': <br />, b: <b /> })
		translate('text')
		translate.rich('attr')
		translate.rich('names', { h1: <h1 />, 'my-tag_2': <i /> })
		// @ts-expect-error only names the parser reads as tags need renderers; <h1> does
		translate.rich('names', { 'my-tag_2': <i /> })
		translate('doubled', { name: 'x' })
		// @ts-expect-error `{{name}}` is the param `name`
		translate('doubled', { '{name': 'x' })
	})

	it('types rich text values and tag renderers', () => {
		expectTypeOf(translate.rich('plain')).toEqualTypeOf<React.ReactNode>()
		translate.rich('terms', { link: <a href="/terms" />, b: chunks => <b>{chunks}</b> })
		translate.rich('greeting', { name: <em>Ada</em> })
		translate.rich('lines', { br: <br /> })

		// @ts-expect-error missing the <b> renderer
		translate.rich('terms', { link: <a /> })
	})

	it('scopes namespaced translators', async () => {
		const home = await i18n.loadTranslator('bn', 'home')
		expectTypeOf(home).toEqualTypeOf<Translator<(typeof en)['home']>>()
		home('subtitle', { user: 'ada' })
		home('nested.deep', { value: 1 })
		// @ts-expect-error keys are relative to the namespace
		home('home.title')
		// @ts-expect-error not a namespace
		void i18n.loadTranslator('bn', 'home.title')
	})

	it('accepts any string key for JSON or untyped messages', async () => {
		const json = createI18n({ defaultLocale: 'en', locales: { en: () => import('./fixtures/bn.json') } })
		const tj = await json.loadTranslator()
		tj('home.title')
		tj('greeting', { name: 'x' })
		// @ts-expect-error JSON still gives typed keys
		tj('nope')

		const untyped = createI18n({ defaultLocale: 'en', locales: { en: {} as Messages } })
		untyped.translate('anything')
		untyped.translate('anything', { any: 1 })
		untyped.translate.rich('anything', { b: <b /> })
	})

	it('reads params and tags from source-text keys when messages are loose', () => {
		// An extracted locale file: JSON types its messages as `string`.
		const { translate } = createI18n({ defaultLocale: 'en', locales: { en: sourceText } })
		translate('Welcome, {firstName}!', { firstName: 'John' })
		// @ts-expect-error missing params
		translate('Welcome, {firstName}!')
		// @ts-expect-error misspelled param
		translate('Welcome, {firstName}!', { firstname: 'John' })
		translate.rich('Read the <link>terms</link>.', { link: <a /> })
		// @ts-expect-error missing the <link> renderer
		translate.rich('Read the <link>terms</link>.')
		translate('{count} files', { count: 2 })
		// @ts-expect-error count is required
		translate('{count} files')

		const untyped = createI18n({ defaultLocale: 'en', locales: { en: {} as Messages } })
		untyped.translate('Hi, {name}', { name: 'x' })
		// @ts-expect-error missing params
		untyped.translate('Hi, {name}')
	})

	it('types the React hooks via Register', () => {
		const Component = () => {
			const translate = useTranslator()
			const home = useTranslator('home')
			const { locale, setLocale } = useI18n()
			expectTypeOf(locale).toEqualTypeOf<'en' | 'ar' | 'bn' | 'bn-BD'>()
			void setLocale('bn')
			// @ts-expect-error unknown namespace
			useTranslator('nope')
			return (
				<>
					{translate('greeting', { name: 'Ada' })}
					{home('title')}
					<Translate i18nKey="plain" />
					<Translate i18nKey="terms" values={{ link: <a />, b: <b /> }} />
					{/* @ts-expect-error values are required for this key */}
					<Translate i18nKey="terms" />
					{/* @ts-expect-error unknown key */}
					<Translate i18nKey="nope" />
				</>
			)
		}
		expectTypeOf(Component).toBeFunction()
	})
})
