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
const { t } = i18n
const home = i18n.translator('en', 'home')
const bnBD = await i18n.getT('bn-BD')
const values = { link: createElement('a', { href: '/terms' }), b: createElement('b') }

const bench = new Bench({ time: 300 })
	.add('plain', () => t('plain'))
	.add('nested', () => t('home.nested.deep', { value: 'x' }))
	.add('namespaced', () => home('title'))
	.add('string param', () => t('greeting', { name: 'Ada' }))
	.add('number param', () => t('total', { amount: 1234.5 }))
	.add('plural', () => t('inbox', { count: 3 }))
	.add('fallback bn-BD → bn → en', () => bnBD('home.title'))
	.add('rich', () => t.rich('terms', values))
	.add('has', () => t.has('home.title'))

await bench.run()
console.table(bench.table(task => ({ task: task.name, 'ops/sec': Math.round(task.result.throughput.mean).toLocaleString('en') })))
