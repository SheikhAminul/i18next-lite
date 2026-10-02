import { describe, expect, it } from 'vitest'
import { getDirection, matchLocale, negotiateLocale, parseAcceptLanguage } from '../src/index.js'

describe('matchLocale', () => {
	const available = ['en', 'en-GB', 'bn', 'zh-Hant', 'pt-BR'] as const

	it('prefers an exact, case- and separator-insensitive match', () => {
		expect(matchLocale('en-GB', available)).toBe('en-GB')
		expect(matchLocale('EN_gb', available)).toBe('en-GB')
	})

	it('drops subtags from the end', () => {
		expect(matchLocale('bn-BD', available)).toBe('bn')
		expect(matchLocale('zh-Hant-TW', available)).toBe('zh-Hant')
	})

	it('falls back to any locale with the same language', () => {
		expect(matchLocale('pt', available)).toBe('pt-BR')
		expect(matchLocale('zh', available)).toBe('zh-Hant')
	})

	it('walks a preference list in order', () => {
		expect(matchLocale(['fr', 'de-AT', 'bn'], available)).toBe('bn')
		expect(matchLocale(['fr-CA', 'en'], ['fr-FR', 'en'])).toBe('fr-FR')
	})

	it('returns undefined when nothing matches', () => {
		expect(matchLocale('fr', available)).toBeUndefined()
		expect(matchLocale(['', 'de'], available)).toBeUndefined()
		expect(matchLocale(undefined, available)).toBeUndefined()
		expect(matchLocale(null, available)).toBeUndefined()
	})
})

describe('parseAcceptLanguage', () => {
	it('orders by quality, keeping header order for ties', () => {
		expect(parseAcceptLanguage('fr;q=0.5, bn-BD, en;q=0.9, de;q=0.9')).toEqual(['bn-BD', 'en', 'de', 'fr'])
	})

	it('drops wildcards, zero-quality and malformed entries', () => {
		expect(parseAcceptLanguage('*, en;q=0, bn;q=abc, ar ; q=0.1')).toEqual(['ar'])
		expect(parseAcceptLanguage('')).toEqual([])
		expect(parseAcceptLanguage(null)).toEqual([])
	})
})

describe('negotiateLocale', () => {
	it('picks the best registered locale or the fallback', () => {
		expect(negotiateLocale('fr;q=0.9, bn-BD;q=0.8', ['en', 'bn'], 'en')).toBe('bn')
		expect(negotiateLocale('fr, de', ['en', 'bn'], 'en')).toBe('en')
		expect(negotiateLocale(undefined, ['en', 'bn'], 'bn')).toBe('bn')
	})
})

describe('getDirection', () => {
	it('detects right-to-left languages and scripts', () => {
		expect(getDirection('ar')).toBe('rtl')
		expect(getDirection('he-IL')).toBe('rtl')
		expect(getDirection('fa_IR')).toBe('rtl')
		expect(getDirection('pa-Arab')).toBe('rtl')
		expect(getDirection('az-Latn-AZ')).toBe('ltr')
		expect(getDirection('ar-Latn')).toBe('ltr')
		expect(getDirection('en')).toBe('ltr')
		expect(getDirection('bn-BD')).toBe('ltr')
	})
})
