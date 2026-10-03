// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cli, extract, extractKeys, syncMessages } from '../src/extract.js'

describe('extractKeys', () => {
	it('finds string literals passed to translators, in order of first use', () => {
		const code = `
			const translate = useTranslator()
			return <>
				<div>{translate('Welcome, {firstName}!', { firstName: 'John' })}</div>
				{t("I am fine.")}
				{translate.rich(\`Read the <link>terms</link>.\`, { link: <a /> })}
				{i18n.translate('Welcome, {firstName}!', { firstName })}
				{translate(
					'Spans lines',
				)}
			</>
		`
		expect(extractKeys(code)).toEqual(['Welcome, {firstName}!', 'I am fine.', 'Read the <link>terms</link>.', 'Spans lines'])
	})

	it('finds <Translate i18nKey> props', () => {
		const code = `<Translate i18nKey="Read the <b>docs</b>" values={{ b: <b /> }} /><Translate values={{}} i18nKey={'Braced'} /><Translate i18nKey='Single' />`
		expect(extractKeys(code)).toEqual(['Read the <b>docs</b>', 'Braced', 'Single'])
	})

	it('decodes escapes in JS strings', () => {
		const code = String.raw`translate('Don\'t'); translate("Say \"hi\"\n"); translate('é\u{1F600}\x41'); translate(` + '`a\\`b`)'
		expect(extractKeys(code)).toEqual(["Don't", 'Say "hi"\n', 'é😀A', 'a`b'])
	})

	it('skips dynamic keys, other functions and commented-out code', () => {
		const code = `
			translate(key)
			translate('Hello ' + name)
			translate(\`Hi \${name}\`)
			translate.has('Checked')
			mytranslate('Mine')
			set('Setter')
			translate('')
			// translate('Commented')
			/* translate('Blocked') */
			{/* translate('In JSX') */}
			translate('Kept') // translate('Trailing comment')
		`
		expect(extractKeys(code)).toEqual(['Kept', 'Trailing comment'])
	})

	it('uses custom translator names', () => {
		expect(extractKeys(`$t('Vue'); __('Underscore'); translate('Default')`, ['$t', '__'])).toEqual(['Vue', 'Underscore'])
	})
})

describe('syncMessages', () => {
	it('maps new keys to themselves and keeps existing values', () => {
		const plural = { one: '{count} file', other: '{count} files' }
		const result = syncMessages(['Hi', '{count} files', 'New'], { Hi: 'Hi there', '{count} files': plural, Gone: 'Gone' })
		expect(result.messages).toEqual({ Hi: 'Hi there', '{count} files': plural, New: 'New' })
		expect(Object.keys(result.messages)).toEqual(['Hi', '{count} files', 'New'])
		expect(result).toMatchObject({ added: 1, removed: 1, untranslated: 0 })
	})

	it('fills other locales from the default locale and counts untranslated messages', () => {
		const base = { Hi: 'Hi', '{count} files': { one: '{count} file', other: '{count} files' } }
		const result = syncMessages(Object.keys(base), { Hi: '¡Hola!' }, base)
		expect(result.messages).toEqual({ Hi: '¡Hola!', '{count} files': base['{count} files'] })
		expect(result).toMatchObject({ added: 1, removed: 0, untranslated: 1 })
	})

	it('keeps unused keys when asked', () => {
		const result = syncMessages(['A'], { Old: 'Old' }, undefined, true)
		expect(result.messages).toEqual({ A: 'A', Old: 'Old' })
		expect(result.removed).toBe(0)
	})

	it('treats __proto__ as an ordinary key', () => {
		const { messages } = syncMessages(['__proto__'], {})
		expect(Object.hasOwn(messages, '__proto__')).toBe(true)
		expect(JSON.stringify(messages)).toBe('{"__proto__":"__proto__"}')
	})
})

describe('extract', () => {
	let cwd: string
	const write = (path: string, content: string) => {
		mkdirSync(dirname(join(cwd, path)), { recursive: true })
		writeFileSync(join(cwd, path), content)
	}
	const read = (path: string) => readFileSync(join(cwd, path), 'utf8')
	const json = (path: string) => JSON.parse(read(path)) as unknown

	beforeEach(() => {
		cwd = mkdtempSync(join(tmpdir(), 'i18next-lite-'))
		write('src/app.tsx', `<div>{translate('Welcome, {firstName}!', { firstName: 'John' })}</div>`)
		write('src/nested/page.ts', `translate('I am fine.')`)
		write('src/node_modules/lib.js', `translate('Ignored')`)
		write('src/types.d.ts', `translate('Declared')`)
		write('src/notes.md', `translate('Markdown')`)
	})
	afterEach(() => {
		rmSync(cwd, { recursive: true, force: true })
		vi.restoreAllMocks()
	})

	it('writes the default locale and every other locale', () => {
		const result = extract({ cwd, locales: ['en', 'es'] })
		expect(result.files).toBe(2)
		expect(json('src/locales/en.json')).toEqual({ 'Welcome, {firstName}!': 'Welcome, {firstName}!', 'I am fine.': 'I am fine.' })
		expect(json('src/locales/es.json')).toEqual(json('src/locales/en.json'))
		expect(result.locales).toEqual([
			{ locale: 'en', file: join('src', 'locales', 'en.json'), messages: 2, added: 2, removed: 0, untranslated: 0, changed: true },
			{ locale: 'es', file: join('src', 'locales', 'es.json'), messages: 2, added: 2, removed: 0, untranslated: 2, changed: true }
		])
	})

	it('keeps translations, finds existing locale files and preserves indentation', () => {
		write('locales/es.json', '{\n\t"I am fine.": "Estoy bien.",\n\t"Old": "Viejo"\n}\n')
		write('locales/bn.json', '{}')
		extract({ cwd, out: 'locales' })
		expect(read('locales/es.json')).toBe(
			'{\n\t"Welcome, {firstName}!": "Welcome, {firstName}!",\n\t"I am fine.": "Estoy bien."\n}\n'
		)
		expect(Object.keys(json('locales/bn.json') as object)).toEqual(['Welcome, {firstName}!', 'I am fine.'])
		expect(json('locales/en.json')).toEqual({ 'Welcome, {firstName}!': 'Welcome, {firstName}!', 'I am fine.': 'I am fine.' })
	})

	it('only reports changes in check mode', () => {
		const check = extract({ cwd, check: true })
		expect(check.locales[0]?.changed).toBe(true)
		expect(() => read('src/locales/en.json')).toThrow()

		extract({ cwd })
		expect(extract({ cwd, check: true }).locales[0]?.changed).toBe(false)
	})

	it('rejects malformed locale files', () => {
		write('src/locales/en.json', '["not", "an", "object"]')
		expect(() => extract({ cwd })).toThrow('must contain a JSON object')
		write('src/locales/en.json', '{ broken')
		expect(() => extract({ cwd })).toThrow('is not valid JSON')
	})

	it('runs from the command line', () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {})
		const error = vi.spyOn(console, 'error').mockImplementation(() => {})
		vi.spyOn(process, 'cwd').mockReturnValue(cwd)

		expect(cli(['extract', 'src', '--locales', 'en,es', '--check'])).toBe(1)
		expect(error).toHaveBeenLastCalledWith(expect.stringContaining('out of date'))
		expect(cli(['extract', 'src', '-l', 'en,es'])).toBe(0)
		expect(log).toHaveBeenCalledWith('Found 2 messages in 2 files.')
		expect(log).toHaveBeenCalledWith(`  ${join('src', 'locales', 'es.json')}: updated (+2), 2 untranslated`)
		expect(cli(['extract', 'src', '-l', 'en,es', '--check'])).toBe(0)

		expect(cli(['--help'])).toBe(0)
		expect(cli([])).toBe(2)
		expect(cli(['extract', '--nope'])).toBe(2)
	})
})
