'use client'

import { I18nProvider } from 'i18next-lite/react'
import type { ReactNode } from 'react'
import { i18n, type Locale } from '@/i18n'

// The instance holds functions, so it can't be passed from a Server Component; this client module imports it instead.
// `locale` pins the tree to the route's locale, giving every request its own isolated state.
export const Providers = ({ locale, children }: { locale: Locale; children: ReactNode }) => (
	<I18nProvider i18n={i18n} locale={locale}>
		{children}
	</I18nProvider>
)
