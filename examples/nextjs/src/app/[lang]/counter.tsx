'use client'

import { useT } from 'i18next-lite/react'
import { useState } from 'react'

export const Counter = () => {
	const t = useT('counter')
	const [count, setCount] = useState(0)
	return (
		<section>
			<h2>{t('label')}</h2>
			<button onClick={() => setCount(count + 1)}>{t('increment')}</button> <span>{t('clicks', { count })}</span>
		</section>
	)
}
