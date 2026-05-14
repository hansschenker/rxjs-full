export type Props = Record<string, unknown> | null;
type Child = HTMLElement | string | number | null | undefined;

const BOOL_PROPS = new Set(['checked', 'disabled', 'selected', 'multiple']);

export function h(
	tag: string | ((props: Props, ...children: HTMLElement[]) => HTMLElement),
	props: Props,
	...children: Child[]
): HTMLElement {
	if (typeof tag === 'function') {
		const resolved = children.map(normalizeChild).filter((n): n is HTMLElement => n !== null);
		return tag(props, ...resolved);
	}

	const el = document.createElement(tag);

	if (props) {
		for (const [key, value] of Object.entries(props)) {
			if (key.startsWith('on') && typeof value === 'function') {
				el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
			} else if (key === 'className') {
				if (value != null) el.className = value as string;
			} else if (BOOL_PROPS.has(key)) {
				(el as unknown as Record<string, unknown>)[key] = Boolean(value);
			} else if (value !== undefined && value !== null) {
				el.setAttribute(key, String(value));
			}
		}
	}

	for (const child of children) {
		const node = normalizeChild(child);
		if (node) el.appendChild(node);
	}

	return el;
}

function normalizeChild(child: Child): Node | null {
	if (child == null) return null;
	if (child instanceof Node) return child;
	return document.createTextNode(String(child));
}

declare global {
	namespace JSX {
		type Element = HTMLElement;
		interface IntrinsicElements { [tag: string]: Props; }
	}
}
