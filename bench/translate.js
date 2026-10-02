// Benchmarks the built package: `npm run bench`
import { createElement } from 'react'
import { Bench } from 'tinybench'
import { createI18n } from '../dist/index.js'

const en = {
	plain: 'Plain text',
	greeting: 'Hello, {name}!',
	inbox: { zero: 'No messages', one: '{count} message', other: '{count} messages' },
	home: { title: 'Welcome', nested: { deep: 'Deep {value}' } },
	terms: 'Read the <link>terms</link> and <b>agree</b>.',
	total: 'Total: {amount}'
}
const i18n = createI18n({ defaultLocale: 'en', locales: { en, bn: { home: {} }, 'bn-BD': {} } })
const { translate } = i18n
const home = i18n.translator('en', 'home')
const bnBD = await i18n.loadTranslator('bn-BD')
let unique = 0
const values = { link: createElement('a', { href: '/terms' }), b: createElement('b') }

const bench = new Bench({ time: 300 })
	.add('plain', () => translate('plain'))
	.add('nested', () => translate('home.nested.deep', { value: 'x' }))
	.add('namespaced', () => home('title'))
	.add('string param', () => translate('greeting', { name: 'Ada' }))
	.add('number param', () => translate('total', { amount: 1234.5 }))
	.add('plural', () => translate('inbox', { count: 3 }))
	.add('plural, a new count every call', () => translate('inbox', { count: unique++ }))
	.add('fallback bn-BD → bn → en', () => bnBD('home.title'))
	.add('rich', () => translate.rich('terms', values))
	.add('has', () => translate.has('home.title'))

await bench.run()
console.table(bench.table(task => ({ task: task.name, 'ops/sec': Math.round(task.result.throughput.mean).toLocaleString('en') })))
