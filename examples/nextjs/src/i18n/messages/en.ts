// The default locale is a TypeScript module with `as const`, so keys *and* params are type-checked.
export default {
	meta: { title: 'i18next-lite + Next.js' },
	home: {
		title: 'Welcome to {site}',
		intro: 'This page was rendered by a <b>Server Component</b>. Read the <docs>docs</docs>.',
		visits: { zero: 'No visits yet', one: '{count} visit', other: '{count} visits' }
	},
	counter: {
		label: 'Client Component',
		clicks: { one: 'Clicked {count} time', other: 'Clicked {count} times' },
		increment: 'Click me'
	},
	switcher: { label: 'Language' }
} as const
