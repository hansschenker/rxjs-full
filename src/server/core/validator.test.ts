import { firstValueFrom, of } from 'rxjs';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery, ValidationError } from './validator';
import type { HttpRequest } from './types';
import type * as http from 'http';

const mockReq = (body: unknown, overrides: Partial<HttpRequest> = {}): HttpRequest => ({
	method: 'GET',
	url: '/',
	params: {},
	query: {},
	body,
	headers: {},
	raw: {} as http.IncomingMessage,
	context: { services: {}, state: {} },
	requestContext: { state: {} },
	...overrides,
});

describe('validation operators', () => {
	it('validates and narrows body values', async () => {
		const result = await firstValueFrom(of(mockReq({ name: 'Alice' })).pipe(
			validateBody(z.object({ name: z.string() })),
		));
		expect(result.body.name).toBe('Alice');
	});

	it('preserves request fields after validation', async () => {
		const result = await firstValueFrom(of(mockReq({ name: 'Carol' }, {
			method: 'POST',
			url: '/items',
			params: { id: '1' },
		})).pipe(validateBody(z.object({ name: z.string() }))));
		expect(result.method).toBe('POST');
		expect(result.url).toBe('/items');
		expect(result.params).toEqual({ id: '1' });
	});

	it('rejects invalid bodies with structured issues', async () => {
		let caught: ValidationError | null = null;
		try {
			await firstValueFrom(of(mockReq({ name: 42 })).pipe(
				validateBody(z.object({ name: z.string() })),
			));
		} catch (err) {
			caught = err as ValidationError;
		}
		expect(caught).toBeInstanceOf(ValidationError);
		expect(caught!.issues.length).toBeGreaterThan(0);
		expect(caught!.details).toEqual(expect.objectContaining({ target: 'body' }));
	});

	it('validates route params', async () => {
		const result = await firstValueFrom(of(mockReq({}, { params: { id: '42' } })).pipe(
			validateParams(z.object({ id: z.string() })),
		));
		expect(result.params.id).toBe('42');
	});

	it('validates query values', async () => {
		const result = await firstValueFrom(of(mockReq({}, { query: { page: '2' } })).pipe(
			validateQuery(z.object({ page: z.string() })),
		));
		expect(result.query.page).toBe('2');
	});
});
