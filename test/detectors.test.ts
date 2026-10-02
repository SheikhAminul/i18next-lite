import { afterEach, describe, expect, it, vi } from 'vitest'
import { cookieDetector, htmlLangDetector, navigatorDetector, queryDetector, storageDetector } from '../src/index.js'

afterEach(() => {
	vi.restoreAllMocks()
	localStorage.clear()
	document.cookie = 'locale=; Max-Age=0; Path=/'
	document.documentElement.lang = ''
	history.replaceState(null, '', '/')
})

describe('detectors', () => {
	it('navigatorDetector reads navigator.languages, then navigator.language', () => {
		vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['bn-BD', 'en'])
		expect(navigatorDetector().detect()).toEqual(['bn-BD', 'en'])

		vi.spyOn(navigator, 'languages', 'get').mockReturnValue([])
		vi.spyOn(navigator, 'language', 'get').mockReturnValue('ar')
		expect(navigatorDetector().detect()).toBe('ar')
	})

	it('storageDetector reads and persists', () => {
		const detector = storageDetector('lang')
		expect(detector.detect()).toBeNull()
		detector.persist!('bn')
		expect(localStorage.getItem('lang')).toBe('bn')
		expect(detector.detect()).toBe('bn')
	})

	it('storageDetector fails soft when storage is unavailable', () => {
		const detector = storageDetector('lang', () => {
			throw new DOMException('denied', 'SecurityError')
		})
		expect(detector.detect()).toBeUndefined()
		expect(() => detector.persist!('bn')).not.toThrow()
	})

	it('cookieDetector reads and persists', () => {
		const detector = cookieDetector()
		expect(detector.detect()).toBeUndefined()
		detector.persist!('bn-BD')
		expect(document.cookie).toContain('locale=bn-BD')
		expect(detector.detect()).toBe('bn-BD')
		expect(cookieDetector('other').detect()).toBeUndefined()
	})

	it('cookieDetector marks SameSite=None cookies Secure, which browsers require', () => {
		const set = vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {})
		cookieDetector().persist!('bn')
		cookieDetector('locale', { sameSite: 'none' }).persist!('bn')
		cookieDetector('locale', { secure: true }).persist!('bn')
		expect(set.mock.calls.map(([cookie]) => cookie)).toEqual([
			'locale=bn; Max-Age=31536000; Path=/; SameSite=lax',
			'locale=bn; Max-Age=31536000; Path=/; SameSite=none; Secure',
			'locale=bn; Max-Age=31536000; Path=/; SameSite=lax; Secure'
		])
	})

	it('queryDetector reads the query string', () => {
		history.replaceState(null, '', '/?lang=ar&x=1')
		expect(queryDetector().detect()).toBe('ar')
		expect(queryDetector('missing').detect()).toBeNull()
	})

	it('htmlLangDetector reads <html lang>', () => {
		document.documentElement.lang = 'bn'
		expect(htmlLangDetector().detect()).toBe('bn')
	})
})
