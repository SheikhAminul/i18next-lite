import type { ReactElement, ReactNode } from 'react'

/** A tree of messages. Leaves are strings or plural objects. */
export interface Messages {
	readonly [key: string]: string | Messages
}

export type PluralCategory = Intl.LDMLPluralRule

/** A message whose form is picked by `count`, e.g. `{ one: '{count} file', other: '{count} files' }`. */
export type PluralMessage = { readonly other: string } & {
	readonly [C in Exclude<PluralCategory, 'other'>]?: string
}

export type MessageLoader = () => Promise<Messages | { readonly default: Messages }>
export type LocaleSource = Messages | MessageLoader

/** Values that can be interpolated into plain-string messages. Numbers and dates are formatted for the locale. */
export type ParamValue = string | number | bigint | Date

/** A rich-text tag renderer: an element to wrap the chunks in, or a function that receives them. */
export type RichTag = ReactElement | ((chunks: ReactNode) => ReactNode)

/** Resolves a locale source (eager object, `() => import(...)`, or JSON module) to its messages type. */
export type MessagesOf<S> = S extends (...args: never[]) => Promise<infer R>
	? R extends { readonly default: infer D }
		? D
		: R
	: S

type IsPlural<T> = [T] extends [PluralMessage] ? ([Exclude<keyof T, PluralCategory>] extends [never] ? true : false) : false

type Leaf<T> = [T] extends [string] ? true : IsPlural<T>

/** Every dot-separated path that points at a message, e.g. `'home.title'`. */
export type MessageKey<T> = string extends keyof T
	? string
	: {
			[K in keyof T & string]: Leaf<T[K]> extends true ? K : `${K}.${MessageKey<T[K]>}`
		}[keyof T & string]

/** Every dot-separated path that points at a group of messages; usable as a `useT()` namespace. */
export type Namespace<T> = string extends keyof T
	? string
	: {
			[K in keyof T & string]: Leaf<T[K]> extends true ? never : K | `${K}.${Namespace<T[K]>}`
		}[keyof T & string]

/** The value found at a dot-separated path. */
export type MessageAt<T, K extends string> = K extends keyof T
	? T[K]
	: K extends `${infer Head}.${infer Rest}`
		? Head extends keyof T
			? MessageAt<T[Head], Rest>
			: never
		: never

type MessageText<V> = [V] extends [PluralMessage] ? V[keyof V] & string : [V] extends [string] ? V : string

type Whitespace = ' ' | '\t' | '\n' | '\r'
type TrimEnd<S extends string> = S extends `${infer Rest}${Whitespace}` ? TrimEnd<Rest> : S

// These mirror the parser's TOKEN pattern in message.ts, so the types ask for exactly what gets rendered.

/** `{name}` params. Names have no whitespace or braces: `{a b}` and `{}` stay text, and `{{a}}` is the param `a`. */
type ParamNames<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
	? Name extends `${string}{${infer Inner}`
		? ParamNames<`{${Inner}}${Rest}`>
		: (Name extends '' | `${string}${Whitespace}${string}` ? never : Name) | ParamNames<Rest>
	: never

/** A tag name starts with a letter and has no whitespace or `/`, e.g. `link`, not `a href`. */
type ValidTagName<Name extends string> = Name extends `${infer First}${string}`
	? Lowercase<First> extends Uppercase<First>
		? never
		: Name extends `${string}${Whitespace | '/'}${string}`
			? never
			: Name
	: never

/** Tag names of `<tag>` and `<tag/>` (whitespace before `>` or `/>` allowed, so `<br />` is `br`). */
type TagNames<S extends string> = S extends `${string}<${infer Tag}>${infer Rest}`
	? Tag extends `${string}<${infer Inner}`
		? TagNames<`<${Inner}>${Rest}`>
		: (Tag extends `/${string}` ? never : ValidTagName<TrimEnd<Tag extends `${infer Name}/` ? Name : Tag>>) | TagNames<Rest>
	: never

type IsLoose<S extends string> = string extends S ? true : false
type CountParam<V> = [V] extends [PluralMessage] ? { readonly count: number | bigint } : {}
/** A plural's `count` comes from `CountParam`; in any other message `{count}` is an ordinary param. */
type NamedParams<V> = [V] extends [PluralMessage] ? Exclude<ParamNames<MessageText<V>>, 'count'> : ParamNames<MessageText<V>>

type LooseParams = { readonly [name: string]: ParamValue }
type LooseRichValues = { readonly [name: string]: ParamValue | ReactNode | RichTag }

export type ParamsOf<V> = CountParam<V> &
	(IsLoose<MessageText<V>> extends true
		? LooseParams
		: { readonly [P in NamedParams<V>]: ParamValue })

export type RichValuesOf<V> = CountParam<V> &
	(IsLoose<MessageText<V>> extends true
		? LooseRichValues
		: { readonly [P in NamedParams<V>]: ParamValue | ReactNode } & {
				readonly [T in TagNames<MessageText<V>>]: RichTag
			})

/** The params argument is optional when the message needs none, and required otherwise. */
type Args<P> = {} extends P ? [params?: P] : [params: P]

export interface Translator<M = Messages> {
	/** Translate `key` to a plain string. Tags such as `<b>` are stripped; use `t.rich` to render them. */
	<K extends MessageKey<M>>(key: K, ...params: Args<ParamsOf<MessageAt<M, K>>>): string
	/** Translate `key` to React nodes, rendering `<tag>` markup with the matching value from `values`. */
	rich<K extends MessageKey<M>>(key: K, ...values: Args<RichValuesOf<MessageAt<M, K>>>): ReactNode
	/** Whether `key` resolves to a message in this locale or one of its fallbacks. */
	has(key: string): boolean
	readonly locale: string
	readonly namespace: string | undefined
}

export interface Formatter {
	readonly locale: string
	number(value: number | bigint, options?: Intl.NumberFormatOptions): string
	date(value: Date | number | string, options?: Intl.DateTimeFormatOptions): string
	relativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions): string
	list(items: Iterable<string>, options?: Intl.ListFormatOptions): string
	displayName(code: string, options: Intl.DisplayNamesOptions): string | undefined
}

/** Reads a preferred locale from somewhere (navigator, storage, cookie, URL) and optionally remembers changes. */
export interface LocaleDetector {
	detect(): string | readonly string[] | null | undefined
	persist?(locale: string): void
}

export interface MissingKeyInfo {
	key: string
	locale: string
}

export interface I18nSnapshot<L extends string = string> {
	/** The active locale. Its messages (and its fallbacks') are loaded. */
	readonly locale: L
	/** A locale being loaded by `setLocale`. The active locale stays visible until it is ready. */
	readonly pendingLocale: L | undefined
}

export interface I18n<L extends string = string, M = Messages> {
	readonly locales: readonly L[]
	readonly defaultLocale: L
	/** The active locale. */
	readonly locale: L
	/** A translator for the active locale. */
	readonly t: Translator<M>
	/** A formatter for the active locale. */
	readonly format: Formatter
	/** True once the active locale and its fallbacks are loaded. */
	readonly isReady: boolean
	/** Settles when the initial locale and its fallbacks are loaded. */
	readonly ready: Promise<void>

	/** Load `locale` (best match) and switch to it once loaded. Concurrent calls: the last one wins. */
	setLocale(locale: string | readonly string[]): Promise<void>
	/** Pick a locale using the configured detectors and switch to it. */
	detect(): Promise<void>
	/** Best registered match for a requested locale or preference list. */
	match(requested: string | readonly string[] | null | undefined): L | undefined
	/** Load a locale's messages and its fallbacks without switching to it. */
	load(locale: string): Promise<void>
	/** Register messages for a locale synchronously, e.g. ones sent from the server. */
	addMessages(locale: L, messages: Messages): void
	/** The loaded messages for a locale, if any. */
	getMessages(locale: L): Messages | undefined
	/** Load `locale` and return a translator bound to it. Does not change the active locale. Ideal for Server Components. */
	getT<N extends Namespace<M> | undefined = undefined>(
		locale?: string,
		namespace?: N
	): Promise<Translator<N extends string ? MessageAt<M, N> : M>>
	/** A translator for an already-loaded locale. */
	translator<N extends Namespace<M> | undefined = undefined>(
		locale: L,
		namespace?: N
	): Translator<N extends string ? MessageAt<M, N> : M>
	formatter(locale: string): Formatter

	/** A new instance with its own active locale that shares this one's config and loaded messages. */
	clone(options?: { locale?: string }): I18n<L, M>
	subscribe(listener: () => void): () => void
	getSnapshot(): I18nSnapshot<L>
}
