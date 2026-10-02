import Link from 'next/link'
import { i18n } from '@/i18n'
import { Counter } from './counter'
import { LanguageSwitcher } from './language-switcher'

const Home = async ({ params }: { params: Promise<{ lang: string }> }) => {
	// Server Components have no context: ask for a translator bound to the route's locale.
	const { lang } = await params
	const translate = await i18n.loadTranslator(lang, 'home')
	const format = i18n.formatter(translate.locale)

	return (
		<main style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '4rem auto', lineHeight: 1.6 }}>
			<LanguageSwitcher />
			<h1>{translate('title', { site: 'i18next-lite' })}</h1>
			<p>{translate.rich('intro', { b: <strong />, docs: chunks => <Link href="https://github.com/SheikhAminul/i18next-lite">{chunks}</Link> })}</p>
			<p>
				{translate('visits', { count: 1234 })} · {format.date(new Date(Date.UTC(2026, 9, 2)), { dateStyle: 'full', timeZone: 'UTC' })}
			</p>
			<Counter />
		</main>
	)
}

export default Home
