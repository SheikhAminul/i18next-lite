i18next-lite<br>
[![NPM Version](https://img.shields.io/npm/v/i18next-lite.svg?branch=main)](https://www.npmjs.com/package/i18next-lite)
[![Publish Size](https://badgen.net/packagephobia/publish/i18next-lite)](https://packagephobia.now.sh/result?p=i18next-lite)
[![Downloads](https://img.shields.io/npm/dt/i18next-lite)](https://www.npmjs.com/package/i18next-lite)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/SheikhAminul/i18next-lite/blob/main/LICENSE)
================

i18next-lite is a lightweight and super simple i18n/internationalization module for React.  
Why this? i18next-lite is specially designed only for React. Developed using modern React APIs. It is super simple, lightweight, fast and provides the necessary APIs to implement multiple language support.


## Table of Contents

*   [Features](#features)
*   [Install](#install)
*   [Usage](#usage)
*   [Documentation](#documentation)
*   [Contributing](#contributing)
*   [License](#license)
*   [Author](#author)


## Features

*   Internationalization or implementation of multiple language support in React.
*   Translation using predefined translations-library.
*   Integrating dynamic values into translations.
*   Loading translations dynamically from JSON data.
*   Ability to change language without reloading the page.
*   Automatic detection of system/browser language. (Automatically shows translation in the system/browser language if the system/browser language exists in the supplied translation data.)


## Install

```plaintext
npm i i18next-lite
```


## Usage

A minimal example of implementing 3 languages with the ability to switch languages. [Try/run this live on CodeSandbox.](https://codesandbox.io/s/infallible-wright-cij8np?file=/src/index.jsx)

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
            <div>
                <span onClick={() => configure({ language: 'en' })}>English</span> |
                <span onClick={() => configure({ language: 'es' })}>Spanish</span> |
                <span onClick={() => configure({ language: 'bn' })}>Bangla</span>
            </div>
        </div>
    )
}

const rootElement = document.getElementById('root')
const root = createRoot(rootElement)

root.render(<App />)
```


## Documentation

### TranslationProvider:

The props of the **TranslationProvider** component:

*   **translations** - Required. Your translation data (in JSON format) for different languages.
*   **defaultLanguage** - Optional. The _defaultLanguage_ will be used if the detected browser language does not exist in your translation data. So make sure the _defaultLanguage_ exists in your translation data.
*   **language** - Optional. The language to use. If a valid language is passed, it will use that language and ignore the detected system/browser language.

Example:

```javascript
function App() {
    return (
        <TranslationProvider
            translations={translations}
            defaultLanguage='en'
            language='es'
        >
            ...
        </TranslationProvider>
    )
}
```

### useTranslate (hook):

In your React components, you can use the **useTranslate** hook to get the _translate_ function.

```javascript
const translate = useTranslate()
```

The parameters of the _translate_ function:

*   **key** - Required. The key for a translation that was used in the translation data object.
*   **substitutions** - Optional. Passes dynamic values in the translation.

For substitution, the keys are surrounded by curly brackets:

```javascript
{
    "greeting_message": "Hi {{userName}}. You have {{totalUnread}} messages."
}
```

Example:

```javascript
translate("greeting_message", { userName: "Mr. White", totalUnread: 5 })
// → "Hi Mr. White. You have 5 messages."
```

### useTranslatorConfigurer (hook):

In your React components, you can use the **useTranslatorConfigurer** hook to get the translator _configure_ function. You can change the _language_ or set the _translations_ dynamically using this function.

```javascript
const configure = useTranslatorConfigurer()
```

You can pass the following keys to the parameter of the _configure_ function:

*   **translations** - Optional. Your translation data (in JSON format) for different languages.
*   **language** - Optional. The language to use.

To change language:

```javascript
const configure = useTranslatorConfigurer()
configure({ language: 'en' }) // Changes language to English.
```

### Load/Import from JSON:
Load/import translation data from one more JSON files. [Check this CodeSandbox example for detailed instructions and file/folder structure.](https://codesandbox.io/s/i18next-lite-json-cij8np?file=/src/index.jsx)

```javascript
const translations = {
	...require('../src/locales/en.json'),
	...require('../src/locales/es.json'),
	...require('../src/locales/bn.json')
}
```


## Contributing

You are welcome to contribute! If you are adding a feature or fixing a bug, please contribute to the [GitHub repository](https://github.com/SheikhAminul/i18next-lite/).


## License

i18next-lite is licensed under the [MIT license](https://github.com/SheikhAminul/i18next-lite/blob/main/LICENSE).


## Author

|[![@SheikhAminul](https://avatars.githubusercontent.com/u/25372039?v=4&s=96)](https://github.com/SheikhAminul)|
|:---:|
|[@SheikhAminul](https://github.com/SheikhAminul)|