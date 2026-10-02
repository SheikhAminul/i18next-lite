import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { Component, Suspense, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { storageDetector } from '../src/index.js'
import { I18nProvider, Trans, useFormat, useI18n, useT } from '../src/react.js'
import { createTestI18n, deferred, type TestI18n } from './fixtures/i18n.js'

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
	localStorage.clear()
	document.documentElement.removeAttribute('lang')
	document.documentElement.removeAttribute('dir')
})

const Greeting = () => {
	const t = useT()
	return <p data-testid="greeting">{t('greeting', { name: 'Ada' })}</p>
}

const Switcher = () => {
	const { locale, isPending, pendingLocale, setLocale } = useI18n()
	return (
		<>
			<output data-testid="locale">{locale}</output>
			<output data-testid="pending">{isPending ? pendingLocale : '-'}</output>
			<button onClick={() => void setLocale('ar').catch(() => {})}>ar</button>
			<button onClick={() => void setLocale('bn').catch(() => {})}>bn</button>
		</>
	)
}

const text = (id: string) => screen.getByTestId(id).textContent

describe('I18nProvider + hooks', () => {
	it('renders translations and re-renders on locale change', async () => {
		const i18n = createTestI18n()
		render(
			<I18nProvider i18n={i18n}>
				<Greeting />
				<Switcher />
			</I18nProvider>
		)
		expect(text('greeting')).toBe('Hello, Ada!')

		await act(() => screen.getByText('ar').click())
		expect(text('greeting')).toBe('مرحبا، Ada!')
		expect(text('locale')).toBe('ar')
	})

	it('reacts to setLocale called outside React', async () => {
		const i18n = createTestI18n()
		render(
			<I18nProvider i18n={i18n}>
				<Greeting />
			</I18nProvider>
		)
		await act(() => i18n.setLocale('ar'))
		expect(text('greeting')).toBe('مرحبا، Ada!')
	})

	it('keeps the current locale on screen while a lazy one loads', async () => {
		const bn = deferred<unknown>()
		const i18n = createTestI18n({ bn: () => bn.promise })
		render(
			<I18nProvider i18n={i18n}>
				<Greeting />
				<Switcher />
			</I18nProvider>
		)
		await act(() => screen.getByText('bn').click())
		expect(text('pending')).toBe('bn')
		expect(text('greeting')).toBe('Hello, Ada!')

		await act(async () => bn.resolve({ greeting: 'হ্যালো, {name}!' }))
		expect(text('pending')).toBe('-')
		expect(text('locale')).toBe('bn')
		expect(text('greeting')).toBe('হ্যালো, Ada!')
	})

	it('suspends until a lazy initial locale is loaded', async () => {
		const bn = deferred<unknown>()
		const i18n = createTestI18n({ locale: 'bn', bn: () => bn.promise })
		await act(async () => {
			render(
				<Suspense fallback={<p>loading</p>}>
					<I18nProvider i18n={i18n}>
						<Greeting />
					</I18nProvider>
				</Suspense>
			)
		})
		expect(screen.getByText('loading')).toBeTruthy()
		await act(async () => bn.resolve({ greeting: 'হ্যালো, {name}!' }))
		expect((await screen.findByTestId('greeting')).textContent).toBe('হ্যালো, Ada!')
	})

	it('reports a failed initial load to the nearest error boundary', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const i18n = createTestI18n({ locale: 'bn', bn: () => Promise.reject(new Error('offline')) })
		await act(async () => {
			render(
				<Boundary>
					<Suspense fallback="loading">
						<I18nProvider i18n={i18n}>
							<Greeting />
						</I18nProvider>
					</Suspense>
				</Boundary>
			)
		})
		expect(screen.getByRole('alert').textContent).toBe('offline')
	})

	it('scopes useT to a namespace', () => {
		const Home = () => {
			const t = useT('home')
			return <h1>{t('subtitle', { user: 'ada' })}</h1>
		}
		render(
			<I18nProvider i18n={createTestI18n()}>
				<Home />
			</I18nProvider>
		)
		expect(screen.getByRole('heading').textContent).toBe('Signed in as ada')
	})

	it('returns a stable translator between renders', () => {
		const i18n = createTestI18n()
		const { result, rerender } = renderHook(() => useT(), {
			wrapper: ({ children }) => <I18nProvider i18n={i18n}>{children}</I18nProvider>
		})
		const first = result.current
		rerender()
		expect(result.current).toBe(first)
	})

	it('provides Intl formatters for the active locale', async () => {
		const i18n = createTestI18n()
		const { result } = renderHook(() => useFormat(), {
			wrapper: ({ children }) => <I18nProvider i18n={i18n}>{children}</I18nProvider>
		})
		expect(result.current.number(1234)).toBe('1,234')
		await act(() => i18n.setLocale('bn'))
		expect(result.current.number(1234)).toBe('১,২৩৪')
	})

	it('throws a helpful error outside a provider', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		expect(() => render(<Greeting />)).toThrow('useT() must be used inside <I18nProvider>')
	})
})

describe('Trans', () => {
	it('renders rich text with elements and values', () => {
		const { container } = render(
			<I18nProvider i18n={createTestI18n()}>
				<Trans i18nKey="terms" values={{ link: <a href="/terms" />, b: chunks => <strong>{chunks}</strong> }} />
				<Trans i18nKey="plain" />
			</I18nProvider>
		)
		expect(container.innerHTML).toBe('Read the <a href="/terms">terms</a> and <strong>agree</strong>.Plain text')
	})
})

describe('document sync', () => {
	it('keeps <html lang dir> in sync', async () => {
		const i18n = createTestI18n()
		render(<I18nProvider i18n={i18n} />)
		expect(document.documentElement.lang).toBe('en')
		expect(document.documentElement.dir).toBe('ltr')

		await act(() => i18n.setLocale('ar'))
		expect(document.documentElement.lang).toBe('ar')
		expect(document.documentElement.dir).toBe('rtl')
	})

	it('can be turned off', () => {
		render(<I18nProvider i18n={createTestI18n()} syncDocument={false} />)
		expect(document.documentElement.hasAttribute('lang')).toBe(false)
	})
})

describe('detection', () => {
	it('detects the locale after mount and remembers changes', async () => {
		localStorage.setItem('locale', 'ar')
		const i18n = createTestI18n({ detectors: [storageDetector()] })
		await act(async () => {
			render(
				<I18nProvider i18n={i18n}>
					<Greeting />
					<Switcher />
				</I18nProvider>
			)
		})
		expect(text('locale')).toBe('ar')

		await act(async () => screen.getByText('bn').click())
		await vi.waitFor(() => expect(text('locale')).toBe('bn'))
		expect(localStorage.getItem('locale')).toBe('bn')
	})

	it('can be turned off', async () => {
		localStorage.setItem('locale', 'ar')
		const i18n = createTestI18n({ detectors: [storageDetector()] })
		await act(async () => {
			render(
				<I18nProvider i18n={i18n} detect={false}>
					<Switcher />
				</I18nProvider>
			)
		})
		expect(text('locale')).toBe('en')
	})
})

describe('locale prop', () => {
	const pinned = (i18n: TestI18n, locale: string) => (
		<I18nProvider i18n={i18n} locale={locale} detect>
			<Greeting />
		</I18nProvider>
	)

	it('pins each subtree to its own locale without touching the shared instance', async () => {
		const i18n = createTestI18n({ detectors: [{ detect: () => 'ar' }] })
		render(
			<>
				{pinned(i18n, 'en')}
				{pinned(i18n, 'ar')}
			</>
		)
		expect(screen.getAllByTestId('greeting').map(node => node.textContent)).toEqual(['Hello, Ada!', 'مرحبا، Ada!'])
		expect(i18n.locale).toBe('en')
	})

	it('follows changes to the prop', async () => {
		const i18n = createTestI18n()
		const { rerender } = render(pinned(i18n, 'en'))
		rerender(pinned(i18n, 'ar'))
		expect(text('greeting')).toBe('مرحبا، Ada!')
	})

	it('uses messages passed from the server instead of loading them', () => {
		const loader = vi.fn(() => Promise.resolve({ greeting: 'loaded' }))
		const i18n = createTestI18n({ bn: loader })
		render(
			<I18nProvider i18n={i18n} locale="bn" messages={{ bn: { greeting: 'from server {name}' } }}>
				<Greeting />
			</I18nProvider>
		)
		expect(text('greeting')).toBe('from server Ada')
		expect(loader).not.toHaveBeenCalled()
	})
})

class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
	override state: { error?: Error } = {}
	static getDerivedStateFromError(error: Error) {
		return { error }
	}
	override render() {
		return this.state.error ? <p role="alert">{this.state.error.message}</p> : this.props.children
	}
}
