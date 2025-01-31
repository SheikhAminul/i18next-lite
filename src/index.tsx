import * as React from 'react'
import { createContext, FC, memo, ReactNode, useCallback, useContext, useEffect, useState } from 'react'

type Translations = {
	[language: string]: {
		translation: {
			[key: string]: string
		}
	}
}
type Translation = (string | React.ReactElement)[] | string
type TranslateFunction = (content: string | { [language: string]: string }, substitutions?: { [key: string]: string | React.ReactElement }) => Translation
type ConfigureFunction = ({ language, defaultLanguage, translations }: { language?: string, defaultLanguage?: string, translations?: Translations }) => void

const TranslationContext = createContext({} as {
	configure: ConfigureFunction,
	translate: TranslateFunction,
	configuration: { language: string, defaultLanguage?: string }
})

const validateConfiguration = ({ language, defaultLanguage, translations }: { language?: string, defaultLanguage?: string, translations?: Translations }) => {
	if (!language && translations) {
		language = navigator.language
		if (!translations[language]) language = language.substring(0, 2)
		if (!translations[language]) language = navigator.languages.find(language => translations[language]) as string
		if (!translations[language]) language = translations[defaultLanguage as string] ? defaultLanguage : Object.keys(translations)[0]
	}
	return { language, defaultLanguage, translations } as { translations: Translations, language: string, defaultLanguage?: string }
}

const TranslationProvider: FC<{
	language?: string,
	defaultLanguage?: string,
	translations: Translations,
	children: ReactNode
}> = memo(({ language, defaultLanguage, translations, children }) => {
	const [configuration, setConfiguration] = useState(
		validateConfiguration({
			translations,
			...(language ? { language } : {}),
			...(defaultLanguage ? { defaultLanguage } : {})
		})
	)

	const { translation: activeTranslation } = configuration.translations[configuration.language]

	const configure = useCallback((translatorConfiguration: { language?: string, defaultLanguage?: string, translations?: Translations }) => {
		setConfiguration((configuration) => validateConfiguration({
			...configuration,
			...translatorConfiguration
		}))
	}, [])

	const translate = useCallback((content: string | { [language: string]: string }, substitutions?: { [key: string]: string | React.ReactElement }): Translation => {
		let translation: Translation = typeof content === 'string' ? activeTranslation[content] : content?.[configuration.language]
		if (!translation) {
			translation = typeof content === 'string' ? content : content?.[configuration.defaultLanguage as string]
			console.warn('No translation found!', { content, configuration })
		}
		if (substitutions) {
			translation = translation.split(/(\{\{[^{}]+\}\})/).filter(Boolean)
			let stringOnly = true

			translation = translation.map((segment, index) => {
				const key = (segment as string).match(/^\{\{([^{}]+)\}\}$/)?.[1]
				if (!key && !substitutions.hasOwnProperty(key as string)) return segment
				const value = substitutions[key as string]
				if (typeof value === 'string') {
					return value
				} else {
					stringOnly = false
					return <React.Fragment key={index}>{value}</React.Fragment>
				}
			})

			translation = stringOnly ? translation.join('') : translation.map((value, index) => {
				return typeof value === 'string' ? <React.Fragment key={index}>{value}</React.Fragment> : value
			})
		}
		return translation
	}, [activeTranslation])

	useEffect(() => {
		if (language !== configuration.language || defaultLanguage !== configuration.defaultLanguage || translations !== configuration.translations) configure({
			language, defaultLanguage, translations
		})
	}, [language, defaultLanguage, translations])

	return (
		<TranslationContext.Provider value={{ configure, translate, configuration }}   >
			{children}
		</TranslationContext.Provider>
	)
})

const useTranslate = () => {
	const { translate } = useContext(TranslationContext) || {}
	if (!translate) throw new Error('useTranslate must be used within TranslationProvider.')
	return translate as TranslateFunction
}

const useTranslatorConfigurer = () => {
	const { configure } = useContext(TranslationContext) || {}
	if (!configure) throw new Error('useTranslatorConfigurer must be used within TranslationProvider.')
	return configure as ConfigureFunction
}

const useTranslatorConfiguration = () => {
	const { configuration } = useContext(TranslationContext) || {}
	if (!configuration) throw new Error('useTranslatorConfigurer must be used within TranslationProvider.')
	return configuration as { language: string, defaultLanguage?: string }
}

export { useTranslate, useTranslatorConfigurer, useTranslatorConfiguration, TranslationProvider }