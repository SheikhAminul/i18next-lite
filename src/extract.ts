/// <reference types="node" />
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { parseArgs } from 'node:util'

/** A locale file: source text → translation (a string or a plural object). */
export type LocaleMessages = { readonly [key: string]: unknown }

export interface ExtractOptions {
	/** Files or directories to scan. Default `['src']`. */
	paths?: readonly string[] | undefined
	/** The directory holding `<locale>.json` files. Default `'src/locales'`. */
	out?: string | undefined
	/** Locales to write, default first. Default: `en`, plus every `<locale>.json` already in `out`. */
	locales?: readonly string[] | undefined
	/** Translator names whose first argument is a message. Default `['translate', 't']`. */
	functions?: readonly string[] | undefined
	/** Keep messages whose key no longer appears in the code. Default `false`. */
	keepUnused?: boolean | undefined
	/** Report which files are out of date without writing them. Default `false`. */
	check?: boolean | undefined
	/** Resolves relative paths. Default `process.cwd()`. */
	cwd?: string | undefined
}

export interface LocaleReport {
	locale: string
	file: string
	messages: number
	added: number
	removed: number
	/** Messages that still equal the default locale's. Always 0 for the default locale. */
	untranslated: number
	/** Whether the file was (or, with `check`, would be) written. */
	changed: boolean
}

export interface ExtractResult {
	files: number
	keys: readonly string[]
	locales: readonly LocaleReport[]
}

// A string literal: quoted, or a template without `${}`.
const LITERAL = /'(?:[^'\\\r\n]|\\[\s\S])*'|"(?:[^"\\\r\n]|\\[\s\S])*"|`(?:[^`\\$]|\\[\s\S]|\$(?!\{))*`/.source
// Commented-out code: whole-line `//` comments, and `/* */` blocks that open a line or a JSX expression.
const COMMENTS = /^[ \t]*\/\/.*$|(?:^[ \t]*|\{\s*)\/\*[\s\S]*?\*\//gm
const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' }
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|vue|svelte|astro)$/
const LOCALE_FILE = /^([a-z]{2,3}(?:[-_][a-z\d]+)*)\.json$/i
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'out', 'coverage'])

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The value of a JS string literal, quotes included. */
const unquote = (literal: string) => {
	const body = literal.slice(1, -1)
	// Templates read line breaks as \n.
	return (literal[0] === '`' ? body.replace(/\r\n?/g, '\n') : body).replace(
		/\\(?:u\{([\da-f]+)\}|u([\da-f]{4})|x([\da-f]{2})|(\r\n|[\s\S]))/gi,
		(_, point?: string, unit?: string, byte?: string, char?: string) =>
			char === undefined
				? String.fromCodePoint(parseInt((point ?? unit ?? byte)!, 16))
				: /^(?:\r\n|[\r\n\u2028\u2029])$/.test(char)
					? '' // a line continuation
					: (ESCAPES[char] ?? char)
	)
}

/**
 * The messages used in `code`, in order of first use: string literals passed to the translator functions (and their
 * `.rich`), and `<Translate i18nKey>` props. Dynamic keys such as `translate(key)` can't be found.
 *
 * @example
 * ```ts
 * extractKeys(`<p>{translate('Hello, {name}!', { name })}</p>`) // ['Hello, {name}!']
 * ```
 */
export const extractKeys = (code: string, functions: readonly string[] = ['translate', 't']): string[] => {
	const names = functions.map(escapeRegExp).join('|')
	const pattern = new RegExp(
		String.raw`(?<![\w$])(?:(?:${names})(?:\.rich)?\s*\(\s*(${LITERAL})\s*[,)]|i18nKey\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(${LITERAL})\s*\}))`,
		'g'
	)
	const keys = new Set<string>()
	for (const [, call, double, single, braced] of code.replace(COMMENTS, ' ').matchAll(pattern)) {
		const key = call ? unquote(call) : braced ? unquote(braced) : (double ?? single)!
		if (key) keys.add(key)
	}
	return [...keys]
}

/**
 * Bring one locale's messages in line with `keys`: existing translations are kept, new keys get the source text
 * (or `base[key]`, the default locale's message), and keys no longer used are dropped unless `keepUnused`.
 */
export const syncMessages = (
	keys: readonly string[],
	existing: LocaleMessages,
	base?: LocaleMessages,
	keepUnused = false
): { messages: LocaleMessages; added: number; removed: number; untranslated: number } => {
	// A Map, then `fromEntries`, so a key like `__proto__` is data rather than a prototype.
	const messages = new Map<string, unknown>()
	let added = 0
	let untranslated = 0
	for (const key of keys) {
		const fallback = base && Object.hasOwn(base, key) ? base[key] : key
		const translated = Object.hasOwn(existing, key)
		if (!translated) added++
		const value = translated ? existing[key] : fallback
		if (base && JSON.stringify(value) === JSON.stringify(fallback)) untranslated++
		messages.set(key, value)
	}
	let removed = 0
	for (const [key, value] of Object.entries(existing)) {
		if (messages.has(key)) continue
		if (keepUnused) messages.set(key, value)
		else removed++
	}
	return { messages: Object.fromEntries(messages), added, removed, untranslated }
}

const sourceFiles = (path: string, found: string[]) => {
	if (!statSync(path).isDirectory()) {
		found.push(path)
		return found
	}
	for (const entry of readdirSync(path, { withFileTypes: true })) {
		const child = join(path, entry.name)
		if (entry.isDirectory()) {
			if (!entry.name.startsWith('.') && !SKIPPED_DIRECTORIES.has(entry.name)) sourceFiles(child, found)
		} else if (SOURCE_FILE.test(entry.name) && !/\.d\.[cm]?ts$/.test(entry.name)) found.push(child)
	}
	return found
}

const readLocale = (file: string): { messages: LocaleMessages; raw: string | undefined } => {
	if (!existsSync(file)) return { messages: {}, raw: undefined }
	const raw = readFileSync(file, 'utf8')
	let messages: unknown
	try {
		messages = raw.trim() ? JSON.parse(raw) : {}
	} catch (error) {
		throw new Error(`${file} is not valid JSON: ${(error as Error).message}`)
	}
	if (typeof messages !== 'object' || messages === null || Array.isArray(messages)) {
		throw new Error(`${file} must contain a JSON object of messages.`)
	}
	return { messages: messages as LocaleMessages, raw }
}

/**
 * Scan source files for messages and write `<locale>.json` for each locale. The default locale maps each message
 * to itself; the others keep their translations and get the source text for new messages, ready to translate.
 */
export const extract = (options: ExtractOptions = {}): ExtractResult => {
	const cwd = options.cwd ?? process.cwd()
	const out = join(cwd, options.out ?? 'src/locales')
	const existingLocales = existsSync(out) ? readdirSync(out).flatMap(name => LOCALE_FILE.exec(name)?.[1] ?? []) : []
	const locales = options.locales?.length ? options.locales : [...new Set(['en', ...existingLocales.sort()])]

	const files = (options.paths?.length ? options.paths : ['src']).flatMap(path => sourceFiles(join(cwd, path), [])).sort()
	const keys = [...new Set(files.flatMap(file => extractKeys(readFileSync(file, 'utf8'), options.functions)))]

	let base: LocaleMessages | undefined
	const reports = locales.map(locale => {
		const file = join(out, `${locale}.json`)
		const existing = readLocale(file)
		const { messages, ...counts } = syncMessages(keys, existing.messages, base, options.keepUnused)
		base ??= messages
		const indent = existing.raw?.match(/^([ \t]+)"/m)?.[1] ?? '  '
		const content = `${JSON.stringify(messages, null, indent)}\n`
		const changed = content !== existing.raw
		if (changed && !options.check) {
			mkdirSync(out, { recursive: true })
			writeFileSync(file, content)
		}
		return { locale, file: relative(cwd, file), messages: keys.length, ...counts, changed }
	})
	return { files: files.length, keys, locales: reports }
}

const HELP = `Usage: i18next-lite extract [paths...] [options]

Finds the messages in your code, e.g. translate('Hello, {name}!', { name }), and writes
one <locale>.json per locale. Existing translations are kept.

Arguments:
  paths                   Files or directories to scan (default: src)

Options:
  -o, --out <dir>         Directory of <locale>.json files (default: src/locales)
  -l, --locales <list>    Comma-separated locales, default locale first (default: en,
                          plus every <locale>.json already in --out)
  -f, --functions <list>  Translator names to look for (default: translate,t)
      --keep-unused       Keep messages that are no longer in the code
      --check             Write nothing; exit with 1 if a file is out of date (for CI)
  -h, --help              Show this help

Example:
  i18next-lite extract src --out src/locales --locales en,es,bn`

const list = (value: string | undefined) => value?.split(',').map(item => item.trim()).filter(Boolean)

/** Run the command line with `args` (without `node` and the script) and return the exit code. */
export const cli = (args: readonly string[]): number => {
	let parsed
	try {
		parsed = parseArgs({
			args: [...args],
			allowPositionals: true,
			options: {
				out: { type: 'string', short: 'o' },
				locales: { type: 'string', short: 'l' },
				functions: { type: 'string', short: 'f' },
				'keep-unused': { type: 'boolean' },
				check: { type: 'boolean' },
				help: { type: 'boolean', short: 'h' }
			}
		})
	} catch (error) {
		console.error(`${(error as Error).message}\n\n${HELP}`)
		return 2
	}
	const { values, positionals } = parsed
	const [command, ...paths] = positionals
	if (values.help || command === 'help') {
		console.log(HELP)
		return 0
	}
	if (command !== 'extract') {
		console.error(`${command ? `Unknown command "${command}".` : 'Missing command.'}\n\n${HELP}`)
		return 2
	}

	let result: ExtractResult
	try {
		result = extract({
			paths,
			out: values.out,
			locales: list(values.locales),
			functions: list(values.functions),
			keepUnused: values['keep-unused'],
			check: values.check
		})
	} catch (error) {
		console.error(`[i18next-lite] ${(error as Error).message}`)
		return 1
	}

	const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`
	console.log(`Found ${count(result.keys.length, 'message')} in ${count(result.files, 'file')}.`)
	for (const report of result.locales) {
		const changes = [report.added && `+${report.added}`, report.removed && `-${report.removed}`].filter(Boolean).join(' ')
		const untranslated = report.untranslated ? `, ${report.untranslated} untranslated` : ''
		const status = report.changed ? (values.check ? 'out of date' : 'updated') : 'up to date'
		console.log(`  ${report.file}: ${status}${changes ? ` (${changes})` : ''}${untranslated}`)
	}
	if (values.check && result.locales.some(report => report.changed)) {
		console.error('Locale files are out of date. Run the same command without --check to update them.')
		return 1
	}
	return 0
}
