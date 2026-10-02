// Same messages, same output, four libraries: `npm run speed`
import i18next from 'i18next'
import { createI18n } from 'i18next-lite'
import { createTranslator } from 'next-intl'
import { createIntl } from 'react-intl'
import { Bench } from 'tinybench'

const lite = createI18n({
	defaultLocale: 'en',
	locales: { en: { plain: 'Plain text', greeting: 'Hello, {name}!', home: { title: 'Welcome' }, inbox: { one: 'You have {count} message', other: 'You have {count} messages' } } }
}).translate

await i18next.init({
	lng: 'en',
	resources: { en: { translation: { plain: 'Plain text', greeting: 'Hello, {{name}}!', home: { title: 'Welcome' }, inbox_one: 'You have {{count}} message', inbox_other: 'You have {{count}} messages' } } }
})

const icu = { plain: 'Plain text', greeting: 'Hello, {name}!', title: 'Welcome', inbox: '{count, plural, one {You have # message} other {You have # messages}}' }
const intl = createIntl({ locale: 'en', messages: icu })
const nextIntl = createTranslator({ locale: 'en', messages: { plain: icu.plain, greeting: icu.greeting, home: { title: 'Welcome' }, inbox: icu.inbox } })

const cases = {
	'plain': [() => lite('plain'), () => i18next.t('plain'), () => intl.formatMessage({ id: 'plain' }), () => nextIntl('plain')],
	'nested': [() => lite('home.title'), () => i18next.t('home.title'), () => intl.formatMessage({ id: 'title' }), () => nextIntl('home.title')],
	'param': [() => lite('greeting', { name: 'Ada' }), () => i18next.t('greeting', { name: 'Ada' }), () => intl.formatMessage({ id: 'greeting' }, { name: 'Ada' }), () => nextIntl('greeting', { name: 'Ada' })],
	'plural': [() => lite('inbox', { count: 3 }), () => i18next.t('inbox', { count: 3 }), () => intl.formatMessage({ id: 'inbox' }, { count: 3 }), () => nextIntl('inbox', { count: 3 })]
}
const libs = ['i18next-lite', 'i18next', 'react-intl', 'next-intl']

// Every library must produce the same text for the comparison to be fair.
for (const [name, fns] of Object.entries(cases)) console.log(name, fns.map(fn => fn()))

const rows = {}
for (const [name, fns] of Object.entries(cases)) {
	const bench = new Bench({ time: 400 })
	fns.forEach((fn, i) => bench.add(libs[i], fn))
	await bench.run()
	rows[name] = Object.fromEntries(bench.tasks.map(task => [task.name, `${(task.result.throughput.mean / 1e6).toFixed(2)} M`]))
}
console.table(rows)
