'use client'

import { useFormat, useI18n, useTranslator } from 'i18next-lite/react'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { localeCookie } from '@/i18n'

// With a URL-based locale, switching language means navigating; the new route's layout passes the new locale down.
export const LanguageSwitcher = () => {
	const translate = useTranslator()
	const { locale, locales } = useI18n()
	const format = useFormat()
	const router = useRouter()
	const pathname = usePathname()
	const [isPending, startTransition] = useTransition()

	return (
		<label>
			{translate('switcher.label')}{' '}
			<select
				value={locale}
				disabled={isPending}
				onChange={event => {
					const next = event.target.value
					localeCookie.persist?.(next)
					startTransition(() => router.push(pathname.replace(`/${locale}`, `/${next}`)))
				}}
			>
				{locales.map(option => (
					<option key={option} value={option}>
						{format.displayName(option, { type: 'language' })}
					</option>
				))}
			</select>
		</label>
	)
}
