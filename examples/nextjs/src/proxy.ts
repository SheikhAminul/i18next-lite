import { negotiateLocale } from 'i18next-lite'
import { NextResponse, type NextRequest } from 'next/server'
import { i18n } from './i18n'

/** Sends requests without a locale prefix to the best locale: saved choice first, then `Accept-Language`. */
export const proxy = (request: NextRequest) => {
	const { pathname } = request.nextUrl
	const hasLocale = i18n.locales.some(locale => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`))
	if (hasLocale) return

	const locale =
		i18n.match(request.cookies.get('NEXT_LOCALE')?.value) ??
		negotiateLocale(request.headers.get('accept-language'), i18n.locales, i18n.defaultLocale)
	request.nextUrl.pathname = `/${locale}${pathname}`
	return NextResponse.redirect(request.nextUrl)
}

export const config = {
	matcher: ['/((?!_next|api|.*\\..*).*)']
}
