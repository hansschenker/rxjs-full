import { created, json, noContent, redirect, withCookie, withHeader } from './response';

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
