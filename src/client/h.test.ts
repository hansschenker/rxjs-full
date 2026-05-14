import { describe, it, expect, vi } from 'vitest';
import { h, type Props } from './h';

describe('h() — element creation', () => {
	it('creates an element with the correct tag', () => {
		const el = h('div', null);
		expect(el.tagName).toBe('DIV');
	});

	it('appends a text child', () => {
		const el = h('span', null, 'hello');
		expect(el.textContent).toBe('hello');
	});

	it('appends a numeric child as text', () => {
		const el = h('span', null, 42);
		expect(el.textContent).toBe('42');
	});

	it('skips null and undefined children', () => {
		const el = h('ul', null, null, undefined, 'kept');
		expect(el.childNodes).toHaveLength(1);
		expect(el.textContent).toBe('kept');
	});

	it('appends multiple children in order', () => {
		const a = h('span', null, 'a');
		const b = h('span', null, 'b');
		const el = h('div', null, a, b);
		expect(el.children[0].textContent).toBe('a');
		expect(el.children[1].textContent).toBe('b');
	});
});

describe('h() — props', () => {
	it('sets className when a string value is given', () => {
		const el = h('div', { className: 'active' });
		expect(el.className).toBe('active');
	});

	it('does not set className when value is undefined', () => {
		const el = h('div', { className: undefined });
		expect(el.className).toBe('');
	});

	it('does not set className when value is null', () => {
		const el = h('div', { className: null });
		expect(el.className).toBe('');
	});

	it('sets boolean prop checked to true', () => {
		const el = h('input', { checked: true }) as HTMLInputElement;
		expect(el.checked).toBe(true);
	});

	it('sets boolean prop checked to false', () => {
		const el = h('input', { checked: false }) as HTMLInputElement;
		expect(el.checked).toBe(false);
	});

	it('sets regular string attributes via setAttribute', () => {
		const el = h('div', { id: 'main', 'data-x': 'val' });
		expect(el.getAttribute('id')).toBe('main');
		expect(el.getAttribute('data-x')).toBe('val');
	});

	it('does not set attribute when value is undefined or null', () => {
		const el = h('div', { 'data-x': undefined, 'data-y': null });
		expect(el.hasAttribute('data-x')).toBe(false);
		expect(el.hasAttribute('data-y')).toBe(false);
	});

	it('attaches click event listener', () => {
		const handler = vi.fn();
		const el = h('button', { onClick: handler });
		el.dispatchEvent(new Event('click'));
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('attaches change event listener', () => {
		const handler = vi.fn();
		const el = h('input', { onChange: handler });
		el.dispatchEvent(new Event('change'));
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('passes null props without error', () => {
		expect(() => h('div', null)).not.toThrow();
	});
});

describe('h() — function component', () => {
	it('calls the function with props and resolved children', () => {
		const Comp = (props: Props, ...children: HTMLElement[]): HTMLElement => {
			const el = document.createElement('section');
			el.dataset['label'] = (props as { label: string }).label;
			children.forEach(c => el.appendChild(c));
			return el;
		};
		const child = h('span', null, 'hi');
		const el = h(Comp, { label: 'test' }, child) as HTMLElement;
		expect(el.tagName).toBe('SECTION');
		expect(el.dataset['label']).toBe('test');
		expect(el.querySelector('span')?.textContent).toBe('hi');
	});
});
