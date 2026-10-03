i18next-lite
================

[![NPM Version](https://img.shields.io/npm/v/i18next-lite.svg?branch=main)](https://www.npmjs.com/package/i18next-lite)
[![Bundle size](https://badgen.net/bundlephobia/minzip/i18next-lite)](https://bundlephobia.com/package/i18next-lite)
[![Downloads](https://img.shields.io/npm/dt/i18next-lite)](https://www.npmjs.com/package/i18next-lite)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/SheikhAminul/i18next-lite/blob/main/LICENSE)

**A lightweight, modern alternative to react-i18next, react-intl and next-intl** for **React 19** and **Next.js App Router**.
It is about 3 kB with zero dependencies and fully type-safe, it works in Server Components, and it translates 4–65× faster than those libraries in [reproducible benchmarks](#comparison).

```tsx
const translate = useTranslator()
translate('inbox', { count: 3 })                     // "You have 3 messages"
translate('greeting', { nam: 'Ada' })                // ✗ TypeScript: did you mean `name`?
<Translate i18nKey="terms" values={{ link: <a href="/terms" /> }} />
```

> Despite the name, this is an independent project. It is not affiliated with or built on i18next.

## Why i18next-lite?

Most React apps need the same things from i18n: typed keys, interpolation, plurals, rich text, number and date formatting, lazy-loaded locales, SSR, and a language switcher. i18next-lite does exactly that, built on modern platform APIs (`Intl`, `useSyncExternalStore`, React 19 `use()`, Server Components) instead of plugins and polyfills:

- **One small package.** No plugin setup, no runtime dependencies, no build step, no message compiler.
- **Types from your messages.** Write the default locale as a TypeScript object and every key, param, plural `count` and rich-text tag is checked. No codegen.
- **Designed for the App Router.** A server-safe core for Server Components, `generateMetadata` and `proxy.ts`. The `'use client'` bindings are a separate entry point. Requests are isolated and hydration is safe.
- **Fast by construction.** Lookups are memoized, plain strings are returned as-is, and components re-render only when the locale changes.

## Features

- **Type-safe**: keys, params, plural `count` and rich-text tags are inferred from your default locale. Typos fail the build.
- **Small**: under 3 kB for the core and about 0.75 kB for the React bindings (minified and brotli-compressed). No dependencies.
- **Fast**: each key resolves once per locale and is then served from a memo. Plain messages are never parsed, and React components re-render only when the locale changes.
- **Plurals** use `Intl.PluralRules`, so `zero`/`one`/`two`/`few`/`many`/`other` work in every language.
- **Formatting** of numbers, dates, relative times, lists and language names uses `Intl` for the active locale.
- **Rich text** like `Read the <link>terms</link>` renders to React elements. There's no `dangerouslySetInnerHTML`.
- **Lazy locales**: `() => import('./bn.json')` is code-split, deduplicated, and keeps the current language on screen while the new one loads.
- **Fallbacks**: a lookup tries `bn-BD`, then `bn`, then your default locale.
- **SSR, Server Components and Next.js App Router**: rendering is hydration-safe and each request's locale is isolated.
- **Detection** from the browser, `localStorage`, a cookie, the query string or `<html lang>`, with the user's choice remembered.
- **RTL**: `<html lang dir>` is kept in sync for you.
- **Source-text keys**: write `translate('Welcome, {name}!', { name })` in your code, and `npx i18next-lite extract` writes the locale files for you.

## Comparison

Each library was measured with the same tooling and the same messages, and each produced identical output. Reproduce with [`bench/compare`](bench/compare): `npm i && npm run size && npm run speed`.

| | i18next-lite 3 | react-i18next 17 + i18next 26 | react-intl 12 | next-intl 4 | Lingui 6 |
|---|---|---|---|---|---|
| **Bundle**: provider, hook, rich-text component (min + brotli) | **3.3 kB** | 18.2 kB | 12.5 kB | 10.1 kB | 3.4 kB¹ |
| **Direct dependencies** | **0** | 3 | 3 | 10 | 3 |
| **`translate('key')`** (ops/sec) | **19 M** | 0.4 M | 1.4 M | 4.4 M | – |
| **`translate('key', { name })`** | **10 M** | 0.26 M | 0.86 M | 0.27 M | – |
| **plural** | **9.9 M** | 0.15 M | 0.26 M | 0.15 M | – |
| Server Components | ✓ | ✓ | ✓ | ✓ | ✓ |
| Works without a build step | ✓ | ✓ | ✓ | ✓ | –¹ |
| Full ICU MessageFormat (`select`, ordinals) | – | via plugin | ✓ | ✓ | ✓ |

<sub>Measured with Node 24, size-limit 14 and tinybench 6. Speed is a single-thread microbenchmark, so absolute numbers vary by machine but the ratios are stable. ¹Lingui compiles messages at build time with its CLI or a macro, which keeps its runtime small; it was left out of the speed test because it needs that compile step. Dependencies are the direct dependencies of the packages you install, not counting each other or peers.</sub>

### When to choose something else

i18next-lite covers what most React and Next.js apps need, but not everything:

- **You need full ICU MessageFormat** (`select` for gender, `selectordinal`, nested plurals) → react-intl, next-intl or Lingui.
- **You rely on the i18next ecosystem** (backend plugins, Locize, frameworks other than React) → i18next.
- **You want locale-aware routing helpers** (localized pathnames, navigation APIs) built into the i18n library → next-intl. With i18next-lite you write a short `proxy.ts` yourself; see [Next.js](#nextjs-app-router).

## Install

```sh
npm i i18next-lite
```

Requires React 19+. The package ships ES modules only.

## Quick start

**1. Define your messages and create an instance.** Write the default locale in TypeScript with `as const` to get typed params. Other locales can be JSON.

```ts
// src/i18n.ts
import { createI18n, navigatorDetector, storageDetector } from 'i18next-lite'

const en = {
	greeting: 'Hello, {name}!',
	inbox: { zero: 'No messages', one: 'You have {count} message', other: 'You have {count} messages' },
	terms: 'Read the <link>terms</link> and <b>agree</b>.',
	settings: { title: 'Settings', language: 'Language' }
} as const

export const i18n = createI18n({
	defaultLocale: 'en',
	locales: {
		en,
		bn: () => import('./locales/bn.json'), // loaded on demand
		ar: () => import('./locales/ar.json')
	},
	detectors: [storageDetector(), navigatorDetector()] // saved choice first, then the browser
})

// Gives the React hooks your keys, params and locales.
declare module 'i18next-lite' {
	interface Register {
		i18n: typeof i18n
	}
}
```

**2. Provide it.**

```tsx
import { I18nProvider } from 'i18next-lite/react'
import { Suspense } from 'react'
import { i18n } from './i18n'

createRoot(root).render(
	<Suspense fallback={null}>
		<I18nProvider i18n={i18n}>
			<App />
		</I18nProvider>
	</Suspense>
)
```

**3. Translate.**

```tsx
import { Translate, useI18n, useTranslator } from 'i18next-lite/react'

const Inbox = ({ count }: { count: number }) => {
	const translate = useTranslator()
	return (
		<>
			<h1>{translate('greeting', { name: 'Ada' })}</h1>
			<p>{translate('inbox', { count })}</p>
			<Translate i18nKey="terms" values={{ link: <a href="/terms" />, b: chunks => <strong>{chunks}</strong> }} />
		</>
	)
}

const LanguagePicker = () => {
	const { locale, locales, setLocale, isPending } = useI18n()
	return (
		<select value={locale} disabled={isPending} onChange={event => setLocale(event.target.value)}>
			{locales.map(code => <option key={code}>{code}</option>)}
		</select>
	)
}
```

## Messages

| Feature | Message | Call | Result |
|---|---|---|---|
| Text | `'Welcome'` | `translate('welcome')` | `Welcome` |
| Nested keys | `{ settings: { title: 'Settings' } }` | `translate('settings.title')` | `Settings` |
| Params | `'Hello, {name}!'` | `translate('greeting', { name: 'Ada' })` | `Hello, Ada!` |
| Numbers, dates | `'Total: {amount}'` | `translate('total', { amount: 1234.5 })` | `Total: 1,234.5` (`১,২৩৪.৫` in `bn`) |
| Plurals | `{ one: '{count} file', other: '{count} files' }` | `translate('files', { count: 2 })` | `2 files` |
| Rich text | `'Read the <link>terms</link>'` | `translate.rich('terms', { link: <a href="/terms" /> })` | `Read the <a href="/terms">terms</a>` |
| Self-closing tags | `'One<br/>Two'` | `translate.rich('lines', { br: <br /> })` | `One<br/>Two` |

- **Plural objects** take the categories `zero`, `one`, `two`, `few`, `many` and `other`, with `other` required. `zero` is used for `0` even in languages whose plural rules never select it, such as English.
- **Tags** render with an element, which is cloned with the chunks as its children, or with a function `chunks => ReactNode`. `translate()` strips tags and keeps their text, which is handy for `aria-label` and `title`.
- **Params** in `translate.rich` can also be React nodes: `translate.rich('greeting', { name: <b>Ada</b> })`.
- **Namespaces** scope keys: `useTranslator('settings')('title')`.
- **Missing keys** fall back through the locale chain. If a key is found nowhere, the key itself is rendered as the message, with its params, and a warning is logged once in development. Customize this with `onMissingKey`.

## Source-text keys and extraction

Instead of inventing keys, you can write the default-language text directly in your code and let the CLI generate the locale files:

```tsx
<div>{translate('Welcome, {firstName}!', { firstName: 'John' })}</div>
<p>{translate('I am fine.')}</p>
<Translate i18nKey="Read the <link>terms</link>." values={{ link: <a href="/terms" /> }} />
```

```sh
npx i18next-lite extract src --out src/locales --locales en,es
```

This scans `src` and writes one file per locale. The first locale is the default, and its file maps each message to itself:

```jsonc
// src/locales/en.json
{
  "Welcome, {firstName}!": "Welcome, {firstName}!",
  "I am fine.": "I am fine.",
  "Read the <link>terms</link>.": "Read the <link>terms</link>."
}
```

The other locales get the same keys, ready to translate:

```jsonc
// src/locales/es.json
{
  "Welcome, {firstName}!": "¡Bienvenido, {firstName}!",
  "I am fine.": "Estoy bien.",
  "Read the <link>terms</link>.": "Lee los <link>términos</link>."
}
```

Use the files like any other messages:

```ts
import en from './locales/en.json'

export const i18n = createI18n({
	defaultLocale: 'en',
	locales: { en, es: () => import('./locales/es.json') }
})
```

- **Re-run it whenever you change the text.** New messages are added and messages no longer in the code are removed. Existing translations, and any message you edited by hand, are kept. Each file's report says how many messages are still untranslated, meaning they are the same as the default locale's.
- **It stays type-safe.** Keys are typed from `en.json`. Params and tags are read from the key itself, so `translate('Welcome, {firstName}!')` without `firstName` fails the build.
- **It works before you extract.** A message missing from every locale renders as its own text, with params filled in, and logs a warning in development.
- **Plurals:** after extracting, change the value in the default locale file to a plural object, for example `"{count} files": { "one": "{count} file", "other": "{count} files" }`. New locales get a copy to translate.
- **Params use single braces**: write `{name}`, not `{{name}}`.
- **Only string literals are found**: `translate('…')`, `translate.rich('…')`, `` translate(`…`) `` without `${}`, and `<Translate i18nKey="…">`. Dynamic keys such as `translate(status)` can't be found; add them to the files yourself and pass `--keep-unused`.
- Use source-text keys with an unscoped translator (`useTranslator()`, not `useTranslator('ns')`). Run the CLI only on projects that use source-text keys; on structured keys like `'settings.title'`, it would map each key to itself.

| Option | Default | |
|---|---|---|
| `[paths...]` | `src` | Files or directories to scan. `node_modules`, build output and dot-directories are skipped. Scans `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`, `.vue`, `.svelte` and `.astro` files |
| `-o, --out <dir>` | `src/locales` | Where the `<locale>.json` files live |
| `-l, --locales <list>` | `en` plus each existing `<locale>.json` | Comma-separated, default locale first |
| `-f, --functions <list>` | `translate,t` | Translator names to look for, e.g. `translate,t,$t` |
| `--keep-unused` | off | Keep messages that are no longer in the code |
| `--check` | off | Write nothing, and exit with 1 if a file is out of date. Use it in CI |

Add it to your scripts so it is easy to re-run: `"i18n": "i18next-lite extract src --out src/locales --locales en,es"`.

## Switching and loading locales

```ts
await i18n.setLocale('bn')        // or ['bn-BD', 'en']: the best match wins
i18n.match('pt-BR')               // 'pt', if that's what you registered
await i18n.load('ar')             // preload without switching
```

- When the target locale is lazy, the current locale stays on screen while it loads. `useI18n().isPending` and `pendingLocale` tell you a switch is in progress.
- If several calls overlap, the last one wins. Each locale loads only once.
- If the initial locale is lazy, `<I18nProvider>` suspends until it's ready, so wrap it in `<Suspense>`.
- Load errors reject `setLocale` and go to your error boundary on first render.

## Formatting

```tsx
const format = useFormat() // or i18n.format / i18n.formatter('bn')
format.number(0.25, { style: 'percent' })              // 25%
format.date(new Date(), { dateStyle: 'long' })         // October 2, 2026
format.relativeTime(-1, 'day', { numeric: 'auto' })    // yesterday
format.list(['a', 'b', 'c'])                           // a, b, and c
format.displayName('bn', { type: 'language' })         // Bangla
```

`Intl` instances are cached per locale and options.

## Detection

`detectors` are tried in order, and the first registered match wins. They run **after hydration**, so server and client markup always agree. Detectors with storage (`storageDetector`, `cookieDetector`) also remember every `setLocale` call. A detected locale isn't saved, so a later change of browser language still takes effect.

| Detector | Reads |
|---|---|
| `navigatorDetector()` | `navigator.languages` |
| `storageDetector(key = 'locale')` | `localStorage` (or any `Storage`) |
| `cookieDetector(name = 'locale', { maxAge, path, sameSite, secure })` | `document.cookie`, which a server can read too. `secure` defaults to `true` with `sameSite: 'none'` |
| `queryDetector(param = 'lang')` | `?lang=bn` |
| `htmlLangDetector()` | `<html lang>` |
| `{ detect, persist? }` | anything you like |

In a client-only app, call `await i18n.detect()` before the first render to skip the default-locale frame.

## Next.js (App Router)

A complete, working example is in [`examples/nextjs`](examples/nextjs): locale-prefixed routes, a proxy, Server and Client Components, and static generation.

```ts
// src/i18n.ts: used by Server Components, Client Components and the proxy
export const i18n = createI18n({
	defaultLocale: 'en',
	locales: { en, bn: () => import('./messages/bn.json') }
})
// Your language switcher calls `localeCookie.persist?.(locale)`; the proxy reads it on the next visit to `/`.
export const localeCookie = cookieDetector('NEXT_LOCALE')
declare module 'i18next-lite' {
	interface Register { i18n: typeof i18n }
}
```

```ts
// src/proxy.ts (middleware.ts before Next 16): send `/` to the best locale
import { negotiateLocale } from 'i18next-lite'
import { NextResponse, type NextRequest } from 'next/server'
import { i18n } from './i18n'

export const proxy = (request: NextRequest) => {
	const { pathname } = request.nextUrl
	if (i18n.locales.some(locale => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`))) return
	const locale = i18n.match(request.cookies.get('NEXT_LOCALE')?.value)
		?? negotiateLocale(request.headers.get('accept-language'), i18n.locales, i18n.defaultLocale)
	request.nextUrl.pathname = `/${locale}${pathname}`
	return NextResponse.redirect(request.nextUrl)
}

export const config = { matcher: ['/((?!_next|api|.*\\..*).*)'] }
```

```tsx
// src/app/[lang]/providers.tsx: the instance can't cross the server/client boundary, so import it here
'use client'
import { I18nProvider } from 'i18next-lite/react'
import { i18n } from '@/i18n'

export const Providers = ({ locale, children }: { locale: string; children: React.ReactNode }) => (
	<I18nProvider i18n={i18n} locale={locale}>{children}</I18nProvider>
)
```

```tsx
// src/app/[lang]/layout.tsx
import { getDirection } from 'i18next-lite'
import { notFound } from 'next/navigation'
import { i18n } from '@/i18n'
import { Providers } from './providers'

export const generateStaticParams = () => i18n.locales.map(lang => ({ lang }))

const RootLayout = async ({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) => {
	const { lang } = await params
	if (i18n.match(lang) !== lang) notFound()
	return (
		<html lang={lang} dir={getDirection(lang)}>
			<body><Providers locale={lang}>{children}</Providers></body>
		</html>
	)
}
export default RootLayout
```

```tsx
// src/app/[lang]/page.tsx: Server Component
const Page = async ({ params }: { params: Promise<{ lang: string }> }) => {
	const translate = await i18n.loadTranslator((await params).lang)
	return <h1>{translate.rich('title', { b: <strong /> })}</h1>
}
export default Page
```

How it fits together:
- **`i18next-lite`** is server-safe and imports no client hooks, so you can use it in Server Components, `generateMetadata`, route handlers and the proxy.
- **`i18next-lite/react`** is marked `'use client'`.
- **`loadTranslator(locale, namespace?)`** loads a locale and returns a translator without touching any shared state. Concurrent requests can't leak into each other.
- **`<I18nProvider locale>`** gives its subtree a private copy of the instance pinned to that locale, while loaded messages stay shared. To change the language in Client Components, navigate to the other locale's URL.
- **To avoid a client fetch for messages**, pass them from the server: `<I18nProvider locale={lang} messages={{ [lang]: messages }}>`.

## API

### `i18next-lite`

| Export | Description |
|---|---|
| `createI18n(config)` | Creates an instance. Config: `locales`, `defaultLocale`, `locale?`, `fallbacks?` (e.g. `{ 'pt-BR': ['pt-PT'] }`), `detectors?`, `onMissingKey?` |
| `negotiateLocale(acceptLanguage, locales, fallback)` | Best locale for an `Accept-Language` header |
| `matchLocale(requested, locales)` | BCP 47 lookup: exact, then shorter tags, then same language |
| `parseAcceptLanguage(header)` | Locales ordered by `q` |
| `getDirection(locale)` | `'ltr'` or `'rtl'` |
| detectors | `navigatorDetector`, `storageDetector`, `cookieDetector`, `queryDetector`, `htmlLangDetector` |

**Instance:** `locale`, `locales`, `defaultLocale`, `translate`, `format`, `isReady`, `ready`, `setLocale()`, `detect()`, `match()`, `load()`, `loadTranslator()`, `translator()`, `formatter()`, `addMessages()`, `getMessages()`, `clone()`, `subscribe()`, `getSnapshot()`.

**Translator:** `translate(key, params?)` returns a string. `translate.rich(key, values?)` returns a ReactNode. Also `translate.has(key)`, `translate.locale` and `translate.namespace`. A translator's identity is stable per locale, so it's safe in dependency arrays.

### `i18next-lite extract` (CLI)

Generates `<locale>.json` files from the messages in your code. See [Source-text keys and extraction](#source-text-keys-and-extraction).

### `i18next-lite/react`

| Export | Description |
|---|---|
| `<I18nProvider i18n locale? messages? detect? syncDocument?>` | Provides an instance. With `locale`, the subtree is pinned to that locale. `detect` and `syncDocument` default to `true` |
| `useTranslator(namespace?)` | Translator for the active locale |
| `useI18n()` | `{ locale, locales, defaultLocale, dir, setLocale, isPending, pendingLocale, i18n }` |
| `useFormat()` | `Intl` formatters for the active locale |
| `<Translate i18nKey values?>` | Component form of `translate.rich` |

## Performance

`npm run bench` on Node 24 (ops/sec; higher is better):

| Call | ops/sec |
|---|---|
| `translate('plain')` | ~18 M |
| `translate('home.nested.deep', { value })` | ~15 M |
| namespaced `translate('title')` | ~19 M |
| fallback chain `bn-BD → bn → en` | ~19 M |
| `translate('greeting', { name })` | ~11 M |
| `translate('total', { amount: 1234.5 })` (number formatting) | ~10 M |
| `translate('inbox', { count })` (plural) | ~9 M |
| plural with a count never seen before | ~1 M |
| `translate.rich(...)` with two elements | ~320 k |

Why it's fast:
- Each key walks the fallback chain once per translator and is then a single `Map` lookup. The memo is cleared only when messages change.
- Messages without `{` or `<` are returned as-is, never parsed or copied. Parsed trees are shared across locales and namespaces.
- `Intl` calls cost hundreds of nanoseconds, so interpolated numbers and plural categories are remembered per locale. Counts repeat, so most plural calls skip `Intl` entirely.
- Memory stays bounded on a long-running server, even when locales, keys, options or numbers come from user input: caches keyed by such input are capped, and translators remember only keys that exist.
- The store lives outside React and is read with `useSyncExternalStore`. The context value never changes, so components re-render only when the locale does, not when a parent re-renders.

## Migrating from other libraries

The concepts map one to one. The main change in message files is how plurals are written: plural forms become an object instead of suffixed keys or ICU syntax.

### From react-i18next

| react-i18next | i18next-lite |
|---|---|
| `i18n.use(initReactI18next).init({ resources, lng, fallbackLng })` | `createI18n({ locales, defaultLocale, locale })` |
| `{ en: { translation: { … } } }` | `{ en: { … } }` |
| `'Hello {{name}}'` | `'Hello {name}'` |
| `key_one` / `key_other` | `key: { one: '…', other: '…' }` |
| `const { t, i18n } = useTranslation('ns')` | `const translate = useTranslator('ns')`, `const { setLocale } = useI18n()` |
| `i18n.changeLanguage('bn')` | `setLocale('bn')` |
| `<Trans i18nKey="x" components={{ link: <a /> }} />` | `<Translate i18nKey="x" values={{ link: <a /> }} />` |
| `i18next-browser-languagedetector` | `detectors: [storageDetector(), navigatorDetector()]` |
| `i18next-http-backend` | `bn: () => import('./bn.json')` or `() => fetch(url).then(r => r.json())` |

### From next-intl

| next-intl | i18next-lite |
|---|---|
| `<NextIntlClientProvider locale messages>` | `<I18nProvider i18n={i18n} locale messages>` |
| `useTranslations('ns')` | `useTranslator('ns')` |
| `await getTranslations({ locale, namespace })` | `await i18n.loadTranslator(locale, namespace)` |
| `t.rich('x', { b: chunks => <b>{chunks}</b> })` | `translate.rich('x', { b: chunks => <b>{chunks}</b> })` |
| `'{count, plural, one {# item} other {# items}}'` | `{ one: '{count} item', other: '{count} items' }` |
| `useFormatter()`, `useLocale()` | `useFormat()`, `useI18n().locale` |
| `createMiddleware(routing)` | A short `proxy.ts` with `negotiateLocale()`; see [Next.js](#nextjs-app-router) |

### From react-intl

| react-intl | i18next-lite |
|---|---|
| `<IntlProvider locale messages>` | `<I18nProvider i18n={i18n}>` |
| `useIntl().formatMessage({ id }, values)` | `useTranslator()(id, values)` |
| `<FormattedMessage id="x" values={…} />` | `<Translate i18nKey="x" values={…} />` |
| `intl.formatNumber`, `formatDate`, `formatList` | `useFormat().number`, `.date`, `.list` |
| `'{count, plural, one {# item} other {# items}}'` | `{ one: '{count} item', other: '{count} items' }` |

## Migrating from v2

v3 is a rewrite.

| v2 | v3 |
|---|---|
| `<TranslationProvider translations={…} defaultLanguage="en">` | `createI18n({ locales, defaultLocale })`, then `<I18nProvider i18n={i18n}>` |
| `{ en: { translation: { … } } }` | `{ en: { … } }`: no `translation` wrapper, nesting allowed |
| `'Hello {{name}}'` | `'Hello {name}'` |
| `const translate = useTranslate()` | `const translate = useTranslator()` |
| `translate('key', { name: <b>x</b> })` | `translate.rich('key', { name: <b>x</b> })` or `<Translate>` |
| `translate({ en: '…', bn: '…' })` | Put the text in your messages |
| `useTranslatorConfigurer()({ language: 'bn' })` | `useI18n().setLocale('bn')` |
| `useTranslatorConfiguration().language` | `useI18n().locale` |
| Automatic `navigator` detection | `detectors: [navigatorDetector()]` (runs after hydration) |
| `import … from 'i18next-lite'` | Hooks and components come from `i18next-lite/react` |

To update interpolation in your message files, change `{{name}}` to `{name}`. For example, run `sed -i 's/{{ *\([^{} ]*\) *}}/{\1}/g' locales/*.json`.

## Contributing

You are welcome to contribute! If you are adding a feature or fixing a bug, please contribute to the [GitHub repository](https://github.com/SheikhAminul/i18next-lite/).

```sh
npm install
npm test           # unit, React, SSR and hydration tests
npm run typecheck  # includes type-level tests
npm run bench
```

## License

i18next-lite is licensed under the [MIT license](https://github.com/SheikhAminul/i18next-lite/blob/main/LICENSE).

## Author

|[![@SheikhAminul](https://avatars.githubusercontent.com/u/25372039?v=4&s=96)](https://github.com/SheikhAminul)|
|:---:|
|[@SheikhAminul](https://github.com/SheikhAminul)|
