import { firstValueFrom, Subject } from 'rxjs';
import { created, json, noContent, redirect, stream$, withCookie, withHeader } from './response';

describe('response helpers', () => {
	it('build common responses', () => {
		expect(json({ ok: true })).toEqual({ status: 200, body: { ok: true }, headers: {} });
		expect(created({ id: '1' })).toEqual({ status: 201, body: { id: '1' }, headers: {} });
		expect(noContent()).toEqual({ status: 204, headers: {} });
		expect(redirect('/login')).toEqual({ status: 302, headers: { Location: '/login' } });
	});

	it('adds headers and cookies', () => {
		const response = withCookie(withHeader(json({ ok: true }), 'X-Test', 'yes'), 'sid', 'abc', {
			HttpOnly: true,
			Path: '/',
		});
		expect(response.headers).toEqual({
			'X-Test': 'yes',
			'Set-Cookie': 'sid=abc; HttpOnly; Path=/',
		});
	});
});

describe('stream$()', () => {
	it('returns status 200 with SSE headers', () => {
		const res = stream$(new Subject(), 'test');
		expect(res.status).toBe(200);
		expect(res.headers?.['Content-Type']).toBe('text/event-stream');
		expect(res.headers?.['Cache-Control']).toBe('no-cache');
		expect(res.headers?.['Connection']).toBe('keep-alive');
	});

	it('sets the stream field to an Observable', () => {
		const res = stream$(new Subject(), 'test');
		expect(res.stream).toBeDefined();
	});

	it('wraps each emission as an SseEvent with the given event type', async () => {
		const subject = new Subject<string>();
		const res = stream$(subject, 'todos');
		const eventPromise = firstValueFrom(res.stream!);
		subject.next('hello');
		const event = await eventPromise;
		expect(event).toEqual({ event: 'todos', data: 'hello' });
	});

	it('omits the event field when no eventType is given', async () => {
		const subject = new Subject<number>();
		const res = stream$(subject);
		const eventPromise = firstValueFrom(res.stream!);
		subject.next(42);
		const event = await eventPromise;
		expect(event).toEqual({ event: undefined, data: 42 });
	});
});
