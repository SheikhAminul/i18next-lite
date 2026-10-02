// @vitest-environment node
import { Suspense } from 'react'
import { prerender } from 'react-dom/static'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider, Trans, useT } from '../src/react.js'
import { createTestI18n, type TestI18n } from './fixtures/i18n.js'

const Page = () => {
	const t = useT()
	return (
		<main>
			<h1>{t('home.title')}</h1>
			<p>
				<Trans i18nKey="terms" values={{ link: <a href="/terms" />, b: <b /> }} />
			</p>
		</main>
	)
}

/** What a Next.js `app/[lang]/layout.tsx` does: one shared instance, a locale per request. */
const renderRequest = async (i18n: TestI18n, lang?: string) => {
	const { prelude } = await prerender(
		<Suspense fallback="loading">
			<I18nProvider i18n={i18n} locale={lang}>
				<Page />
			</I18nProvider>
		</Suspense>
	)
	return new Response(prelude).text()
}

describe('server rendering', () => {
	it('streams a lazily loaded locale', async () => {
		const html = await renderRequest(createTestI18n(), 'bn')
		expect(html).toContain('<h1>স্বাগতম</h1>')
		expect(html).toContain('<a href="/terms">শর্তাবলী</a> পড়ুন এবং <b>সম্মত হন</b>।')
		expect(html).not.toContain('loading')
	})

	it('isolates concurrent requests that share one instance', async () => {
		const i18n = createTestI18n()
		const [bn, en, ar] = await Promise.all(['bn', 'en', 'ar'].map(lang => renderRequest(i18n, lang)))
		expect(bn).toContain('স্বাগতম')
		expect(en).toContain('Welcome')
		expect(ar).toContain('<h1>Welcome</h1>') // `ar` has no home.title, so it falls back to English
		expect(ar).toContain('<a href="/terms">terms</a>')
		expect(i18n.locale).toBe('en')
	})

	it('never runs detectors on the server', async () => {
		const detect = vi.fn(() => 'ar')
		const html = await renderRequest(createTestI18n({ detectors: [{ detect }] }))
		expect(html).toContain('Welcome')
		expect(detect).not.toHaveBeenCalled()
		expect(typeof document).toBe('undefined')
	})
})
