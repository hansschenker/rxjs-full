import { firstValueFrom, of } from 'rxjs';
import * as t from 'io-ts';
import { validate, ValidationError } from './validator';
import type { HttpRequest } from './types';
import * as http from 'http';

const mockReq = (body: unknown, overrides: Partial<HttpRequest> = {}): HttpRequest => ({
	method: 'GET',
	url: '/',
	params: {},
	query: {},
	body,
	headers: {},
	raw: {} as http.IncomingMessage,
	...overrides,
});

const NameCodec = t.type({ name: t.string });
const OptionalCodec = t.partial({ title: t.string, done: t.boolean });

describe('validate()', () => {
	it('passes a valid body through unchanged', async () => {
		const req$ = of(mockReq({ name: 'Alice' }));
		const result = await firstValueFrom(req$.pipe(validate(NameCodec)));
		expect(result.body.name).toBe('Alice');
	});

	it('body is the correct decoded type — not the raw unknown', async () => {
		const req$ = of(mockReq({ name: 'Bob', extra: 'stripped' }));
		const result = await firstValueFrom(req$.pipe(validate(NameCodec)));
		// io-ts strips unknown keys on t.type — body.name is the decoded value
		expect(result.body.name).toBe('Bob');
	});

	it('preserves all other request fields after validation', async () => {
		const req$ = of(mockReq({ name: 'Carol' }, { method: 'POST', url: '/items', params: { id: '1' } }));
		const result = await firstValueFrom(req$.pipe(validate(NameCodec)));
		expect(result.method).toBe('POST');
		expect(result.url).toBe('/items');
		expect(result.params).toEqual({ id: '1' });
	});

	it('throws ValidationError when body does not match codec', async () => {
		const req$ = of(mockReq({ name: 42 })); // name must be string
		await expect(firstValueFrom(req$.pipe(validate(NameCodec)))).rejects.toBeInstanceOf(ValidationError);
	});

	it('throws ValidationError when required field is missing', async () => {
		const req$ = of(mockReq({})); // name is required
		await expect(firstValueFrom(req$.pipe(validate(NameCodec)))).rejects.toBeInstanceOf(ValidationError);
	});

	it('throws ValidationError when body is null', async () => {
		const req$ = of(mockReq(null));
		await expect(firstValueFrom(req$.pipe(validate(NameCodec)))).rejects.toBeInstanceOf(ValidationError);
	});

	it('accepts partial codec with all fields missing', async () => {
		const req$ = of(mockReq({}));
		const result = await firstValueFrom(req$.pipe(validate(OptionalCodec)));
		expect(result.body).toEqual({});
	});

	it('ValidationError carries io-ts errors', async () => {
		const req$ = of(mockReq({ name: 99 }));
		let caught: ValidationError | null = null;
		try {
			await firstValueFrom(req$.pipe(validate(NameCodec)));
		} catch (e) {
			caught = e as ValidationError;
		}
		expect(caught).toBeInstanceOf(ValidationError);
		expect(caught!.errors.length).toBeGreaterThan(0);
	});
});
