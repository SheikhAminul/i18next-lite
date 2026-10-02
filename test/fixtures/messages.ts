export const en = {
	plain: 'Plain text',
	greeting: 'Hello, {name}!',
	inbox: { zero: 'No messages', one: 'You have {count} message', other: 'You have {count} messages' },
	home: {
		title: 'Welcome',
		subtitle: 'Signed in as {user}',
		nested: { deep: 'Deep {value}' }
	},
	terms: 'Read the <link>terms</link> and <b>agree</b>.',
	lines: 'One<br/>Two',
	total: 'Total: {amount}',
	onlyEnglish: 'Only in English'
} as const

export const ar = {
	plain: 'نص عادي',
	greeting: 'مرحبا، {name}!',
	inbox: {
		zero: 'لا رسائل',
		one: 'رسالة واحدة',
		two: 'رسالتان',
		few: '{count} رسائل',
		many: '{count} رسالة',
		other: '{count} رسالة'
	}
} as const
