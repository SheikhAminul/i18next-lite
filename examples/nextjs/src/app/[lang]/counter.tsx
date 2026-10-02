'use client'

import { useTranslator } from 'i18next-lite/react'
import { useState } from 'react'

export const Counter = () => {
	const translate = useTranslator('counter')
	const [count, setCount] = useState(0)
	return (
		<section>
			<h2>{translate('label')}</h2>
			<button onClick={() => setCount(count + 1)}>{translate('increment')}</button> <span>{translate('clicks', { count })}</span>
		</section>
	)
}
