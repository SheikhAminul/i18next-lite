import { cloneElement, createElement, Fragment, isValidElement, type ReactNode } from 'react'
import { formatValue, pluralRules, reuse } from './format.js'
import type { ParamValue, PluralCategory, PluralMessage } from './types.js'

export type Node = string | { readonly param: string } | { readonly tag: string; readonly children: readonly Node[] }
/** A message ready to render: plain text as-is, anything with params or tags as a parsed tree. */
export type Compiled = string | readonly Node[]
type Frame = { tag: string; raw: string; children: Node[] }
type Values = Readonly<Record<string, unknown>> | undefined

// `{name}`, `<tag>`, `</tag>`, `<tag/>`
const TOKEN = /\{([^{}\s]+)\}|<(\/?)([A-Za-z][\w-]*)\s*(\/?)>/g
const MARKUP = /[{<]/
const PLURAL_CATEGORIES = new Set<string>(['zero', 'one', 'two', 'few', 'many', 'other'] satisfies PluralCategory[])

/** Parse a message into text, params and (possibly nested) tags. Malformed tags are kept as text. */
const parse = (message: string): readonly Node[] => {
	const root: Frame = { tag: '', raw: '', children: [] }
	const stack = [root]
	let top = root
	let last = 0
	for (const match of message.matchAll(TOKEN)) {
		const [raw, param, closing, tag = '', selfClosing] = match
		if (match.index > last) top.children.push(message.slice(last, match.index))
		last = match.index + raw.length

		if (param !== undefined) top.children.push({ param })
		else if (selfClosing) top.children.push({ tag, children: [] })
		else if (!closing) stack.push((top = { tag, raw, children: [] }))
		else if (top !== root && top.tag === tag) {
			const done = stack.pop()!
			top = stack.at(-1)!
			top.children.push({ tag, children: done.children })
		} else top.children.push(raw)
	}
	if (last < message.length) top.children.push(message.slice(last))
	// Unclosed tags are not markup: put them back as text.
	while (stack.length > 1) {
		const frame = stack.pop()!
		stack.at(-1)!.children.push(frame.raw, ...frame.children)
	}
	return root.children
}

// Trees are shared by every translator and namespace that renders the same message.
const parsed = new Map<string, readonly Node[]>()

/** Most messages are plain text: they skip parsing, and the memory for a tree, entirely. */
export const compile = (message: string): Compiled => (MARKUP.test(message) ? reuse(parsed, message, parse) : message)

const isParamValue = (value: unknown): value is ParamValue =>
	typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || value instanceof Date

export const renderString = (nodes: readonly Node[], locale: string, params: Values): string => {
	let out = ''
	for (const node of nodes) {
		if (typeof node === 'string') out += node
		else if ('param' in node) {
			const value = params?.[node.param]
			out += value === undefined ? `{${node.param}}` : isParamValue(value) ? formatValue(locale, value) : String(value)
		} else out += renderString(node.children, locale, params)
	}
	return out
}

export const renderRich = (nodes: readonly Node[], locale: string, values: Values, onMissingTag: (tag: string) => void): ReactNode[] => {
	const out: ReactNode[] = []
	for (const node of nodes) {
		if (typeof node === 'string') out.push(node)
		else if ('param' in node) {
			const value = values?.[node.param]
			out.push(value === undefined ? `{${node.param}}` : isParamValue(value) ? formatValue(locale, value) : (value as ReactNode))
		} else {
			const children = renderRich(node.children, locale, values, onMissingTag)
			const render = values?.[node.tag]
			if (typeof render === 'function') out.push((render as (chunks: ReactNode) => ReactNode)(toNode(children)))
			else if (isValidElement(render)) out.push(cloneElement(render, undefined, ...children))
			else {
				onMissingTag(node.tag)
				out.push(...children)
			}
		}
	}
	return out
}

/** Collapse rendered parts: plain text stays a string; anything else becomes a keyless fragment. */
export const toNode = (parts: ReactNode[]): ReactNode =>
	parts.every(part => typeof part === 'string')
		? parts.join('')
		: parts.length === 1
			? parts[0]
			: createElement(Fragment, null, ...parts)

export const isPluralMessage = (value: unknown): value is PluralMessage =>
	typeof value === 'object' &&
	value !== null &&
	typeof (value as PluralMessage).other === 'string' &&
	Object.keys(value).every(key => PLURAL_CATEGORIES.has(key))

/** The form to use for `count`. `zero` is honoured for 0 even where plural rules never pick it (e.g. English). */
export const pluralCategory = (message: PluralMessage, locale: string, count: unknown): PluralCategory => {
	if (typeof count !== 'number' && typeof count !== 'bigint') return 'other'
	const n = Number(count)
	if (n === 0 && message.zero !== undefined) return 'zero'
	const category = pluralRules(locale)(n)
	return message[category] === undefined ? 'other' : category
}
