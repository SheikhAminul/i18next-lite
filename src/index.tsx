import * as React from 'react'
import { createContext, ReactElement, useContext, useState } from 'react'

type Translations = {
    [language: string]: {
        translation: {
            [key: string]: string
        }
    }
}
type TranslateFunction = (key: string, substitutions?: any) => string
type ConfigureFunction = ({ language, defaultLanguage, translations }: { language?: string, defaultLanguage?: string, translations?: Translations }) => void

const TranslationContext = createContext({} as {
    configure: ConfigureFunction,
    translate: TranslateFunction,
    configuration: { language: string, defaultLanguage?: string }
})

function TranslationProvider({ language, defaultLanguage, translations, children }: { language?: string, defaultLanguage?: string, translations: Translations, children: ReactElement }) {
    function validateConfiguration({ language, defaultLanguage, translations }: { language?: string, defaultLanguage?: string, translations?: Translations }) {
        if (!language && translations) {
            language = navigator.language
            if (!translations[language]) language = language.substring(0, 2)
            if (!translations[language]) language = navigator.languages.find(language => translations[language]) as string
            if (!translations[language]) language = translations[defaultLanguage as string] ? defaultLanguage : Object.keys(translations)[0]
        }
        return { language, defaultLanguage, translations } as { translations: Translations, language: string, defaultLanguage?: string }
    }

    const [configuration, setConfiguration] = useState(
        validateConfiguration({
            translations,
            ...(language ? { language } : {}),
            ...(defaultLanguage ? { defaultLanguage } : {})
        })
    )

    const { translation: activeTranslation } = configuration.translations[configuration.language]

    function configure(translatorConfiguration: { language?: string, defaultLanguage?: string, translations?: Translations }) {
        setConfiguration(
            validateConfiguration({
                ...configuration,
                ...translatorConfiguration
            })
        )
    }

    function translate(key: string, substitutions?: any) {
        let translation = activeTranslation[key]
        if (!translation) console.error(`The key "${key}" was not found!`)
        return translation?.replace(/{{[^{}]+}}/, (substitution: string) => substitutions[substitution.slice(2, -2)]) as string
    }

    return (
        <TranslationContext.Provider value={{ configure, translate, configuration }}   >
            {children}
        </TranslationContext.Provider>
    )
}

function useTranslate() {
    const { translate } = useContext(TranslationContext) || {}
    if (!translate) throw new Error('useTranslate must be used within TranslationProvider.')
    return translate as TranslateFunction
}

function useTranslatorConfigurer() {
    const { configure } = useContext(TranslationContext) || {}
    if (!configure) throw new Error('useTranslatorConfigurer must be used within TranslationProvider.')
    return configure as ConfigureFunction
}

function useTranslatorConfiguration() {
    const { configuration } = useContext(TranslationContext) || {}
    if (!configuration) throw new Error('useTranslatorConfigurer must be used within TranslationProvider.')
    return configuration as { language: string, defaultLanguage?: string }
}

export { useTranslate, useTranslatorConfigurer, useTranslatorConfiguration, TranslationProvider }