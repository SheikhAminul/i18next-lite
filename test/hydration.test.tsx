import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { storageDetector } from '../src/index.js'
import { I18nProvider, useI18n, useTranslator } from '../src/react.js'
import { createTestI18n, type TestI18n } from './fixtures/i18n.js'

afterEach(() => localStorage.clear())

const App = ({ i18n }: { i18n: TestI18n }) => (
	<I18nProvider i18n={i18n}>
		<Page />
	</I18nProvider>
)

const Page = () => {
	const translate = useTranslator()
	const { locale, dir } = useI18n()
	return (
		<p lang={locale} dir={dir}>
			{translate('greeting', { name: 'Ada' })}
		</p>
	)
}

it('hydrates without mismatches, then applies the detected locale', async () => {
	// The server can't see localStorage, so it renders the default locale…
	const container = document.createElement('div')
	container.innerHTML = renderToString(<App i18n={createTestI18n()} />)
	expect(container.textContent).toBe('Hello, Ada!')

	// …and the client must hydrate that same markup before switching to the stored preference.
	localStorage.setItem('locale', 'ar')
	const onRecoverableError = vi.fn()
	const consoleError = vi.spyOn(console, 'error')
	const client = createTestI18n({ detectors: [storageDetector()] })
	await act(async () => {
		hydrateRoot(container, <App i18n={client} />, { onRecoverableError })
	})

	expect(onRecoverableError).not.toHaveBeenCalled()
	expect(consoleError).not.toHaveBeenCalled()
	expect(container.innerHTML).toBe('<p lang="ar" dir="rtl">مرحبا، Ada!</p>')
})
