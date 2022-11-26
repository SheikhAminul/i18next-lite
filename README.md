i18next-lite<br>
[![NPM Version](https://img.shields.io/npm/v/i18next-lite.svg?branch=main)](https://www.npmjs.com/package/i18next-lite)  
[![Publish Size](https://badgen.net/packagephobia/publish/i18next-lite)](https://packagephobia.now.sh/result?p=i18next-lite)  
[![Downloads](https://img.shields.io/npm/dt/i18next-lite)](https://www.npmjs.com/package/i18next-lite)  
[![Downloads Per Month](https://img.shields.io/npm/dm/storage-sync-lite)](https://www.npmjs.com/package/i18next-lite)  
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/SheikhAminul/i18next-lite/blob/main/LICENSE)  
================

i18next-lite is a lightweight and super simple i18n/internationalization module for React().  
Why this? i18next-lite is specially designed only for React. Developed using modern React APIs. It is super simple, lightweight, fast and provides the necessary APIs to implement multiple language support.


## Table of Contents

*   [Features](#features)
*   [Install](#install)
*   [Usage](#usage)
*   [License](#license)
*   [Author](#author)


## Features

*   Internationalization or implementation of multiple language support in React.
*   Translation using predefined translations-library.
*   Integrating dynamic values into translations.
*   Loading translations dynamically from JSON data.
*   Ability to change language without reloading the page.


## Install

```plaintext
npm i i18next-lite
```


## Usage

A minimal example of implementing 3 languages with the ability to switch languages.

```javascript
import { createRoot } from 'react-dom/client'
import { TranslationProvider, useTranslate, useTranslatorConfigurer } from 'i18next-lite'

const translations = {
    en: {
        translation: {
            hello: 'Hello {{userName}}',
            good_morning: 'Good morning.',
            how_are_you: 'How are you today?'
        }
    },
    es: {
        translation: {
            hello: 'Hola {{userName}}',
            good_morning: 'Buenos dias.',
            how_are_you: '¿Cómo estás hoy?'
        }
    },
    bn: {
        translation: {
            hello: 'হ্যালো {{userName}}',
            good_morning: 'সুপ্রভাত.',
            how_are_you: 'আপনি আজ কেমন আছেন?'
        }
    }
}

function App() {
    return (
        <TranslationProvider translations={translations} defaultLanguage='en'>
            <ExampleComponent />
        </TranslationProvider>
    )
}

function ExampleComponent() {
    const translate = useTranslate()
    return (
        <div>
            <h2>{translate('hello', { userName: 'John Doe' })}</h2>
            <h3>
                {translate('good_morning')}
                <br />
                {translate('how_are_you')}
            </h3>
            <ExampleLanguageSwitcher />
        </div>
    )
}

function ExampleLanguageSwitcher() {
    const configure = useTranslatorConfigurer();
    return (
        <div>
            <div>Select language:</div>
            <div style={{ display: 'flex', gap: '0.5em', cursor: 'pointer', color: 'blue' }} >
                <span onClick={() => configure({ language: 'en' })}>English</span>|
                <span onClick={() => configure({ language: 'es' })}>Spanish</span>|
                <span onClick={() => configure({ language: 'bn' })}>Bangla</span>
            </div>
        </div>
    );
}

const rootElement = document.getElementById('root')
const root = createRoot(rootElement)

root.render(<App />)
```