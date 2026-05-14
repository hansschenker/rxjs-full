import { describe, it, expect, vi } from 'vitest';
import { TodoItem } from './todo-item';
import type { Todo } from '../../shared/types';

const baseTodo: Todo = {
	id: '1',
	title: 'Buy milk',
	completed: false,
	createdAt: '2026-01-01T00:00:00.000Z',
};

describe('TodoItem', () => {
	it('renders an li element', () => {
		const el = TodoItem({ todo: baseTodo, onToggle: () => {}, onDelete: () => {} });
		expect(el.tagName).toBe('LI');
	});

	it('has no className when todo is not completed', () => {
		const el = TodoItem({ todo: { ...baseTodo, completed: false }, onToggle: () => {}, onDelete: () => {} });
		expect(el.className).toBe('');
	});

	it('has className "completed" when todo is completed', () => {
		const el = TodoItem({ todo: { ...baseTodo, completed: true }, onToggle: () => {}, onDelete: () => {} });
		expect(el.className).toBe('completed');
	});

	it('renders a checkbox that is unchecked when todo is not completed', () => {
		const el = TodoItem({ todo: { ...baseTodo, completed: false }, onToggle: () => {}, onDelete: () => {} });
		const input = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(input).not.toBeNull();
		expect(input.checked).toBe(false);
	});

	it('renders a checkbox that is checked when todo is completed', () => {
		const el = TodoItem({ todo: { ...baseTodo, completed: true }, onToggle: () => {}, onDelete: () => {} });
		const input = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(input.checked).toBe(true);
	});

	it('shows the todo title in a span', () => {
		const el = TodoItem({ todo: baseTodo, onToggle: () => {}, onDelete: () => {} });
		const span = el.querySelector('span');
		expect(span?.textContent).toBe('Buy milk');
	});

	it('calls onToggle when the checkbox fires a change event', () => {
		const onToggle = vi.fn();
		const el = TodoItem({ todo: baseTodo, onToggle, onDelete: () => {} });
		const input = el.querySelector('input') as HTMLInputElement;
		input.dispatchEvent(new Event('change'));
		expect(onToggle).toHaveBeenCalledTimes(1);
	});

	it('calls onDelete when the Delete button is clicked', () => {
		const onDelete = vi.fn();
		const el = TodoItem({ todo: baseTodo, onToggle: () => {}, onDelete });
		const button = el.querySelector('button') as HTMLButtonElement;
		button.dispatchEvent(new Event('click'));
		expect(onDelete).toHaveBeenCalledTimes(1);
	});
});
