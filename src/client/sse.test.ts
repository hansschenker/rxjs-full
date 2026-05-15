import { firstValueFrom } from 'rxjs';
import { vi, beforeEach, afterEach } from 'vitest';
import { fromEventSource } from './sse';

const createMockEventSource = () => {
	const listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
	const mock = {
		addEventListener: vi.fn((type: string, handler: (e: MessageEvent) => void) => {
			if (!listeners[type]) listeners[type] = [];
			listeners[type].push(handler);
		}),
		onerror: null as ((e: Event) => void) | null,
		close: vi.fn(),
		emit: (type: string, data: unknown) => {
			listeners[type]?.forEach(h => h({ data: JSON.stringify(data) } as MessageEvent));
		},
		triggerError: () => { mock.onerror?.(new Event('error')); },
	};
	return mock;
};

describe('fromEventSource()', () => {
	let mockEs: ReturnType<typeof createMockEventSource>;

	beforeEach(() => {
		mockEs = createMockEventSource();
		vi.stubGlobal('EventSource', vi.fn(function() { return mockEs; }));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('emits parsed data for the named event type', async () => {
		const todos = [{ id: '1', title: 'Test', completed: false }];
		const result = firstValueFrom(fromEventSource('/api/todos/stream', 'todos'));
		mockEs.emit('todos', todos);
		expect(await result).toEqual(todos);
	});

	it('closes the EventSource when unsubscribed', () => {
		const subscription = fromEventSource('/api/todos/stream', 'todos').subscribe();
		subscription.unsubscribe();
		expect(mockEs.close).toHaveBeenCalledOnce();
	});

	it('closes the EventSource when the observable errors', () => {
		fromEventSource('/api/todos/stream', 'todos').subscribe({ error: () => {} });
		mockEs.close.mockClear();
		mockEs.triggerError();
		expect(mockEs.close).toHaveBeenCalledOnce();
	});

	it('errors the Observable when EventSource fires onerror', () => {
		let capturedError: Error | undefined;
		fromEventSource('/api/todos/stream', 'todos').subscribe({
			error: (err: unknown) => { capturedError = err as Error; },
		});
		mockEs.triggerError();
		expect(capturedError).toBeInstanceOf(Error);
		expect(capturedError?.message).toBe('EventSource error');
	});

	it('does not emit for unregistered event types', () => {
		let emitted = false;
		fromEventSource('/api/todos/stream', 'todos').subscribe({
			next: () => { emitted = true; },
		});
		mockEs.emit('other', {});
		expect(emitted).toBe(false);
	});
});
