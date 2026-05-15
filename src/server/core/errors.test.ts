import { vi } from 'vitest';
import {
	BadRequest,
	Forbidden,
	HttpError,
	NotFound,
	Unauthorized,
	UnprocessableEntity,
	errorResponse,
} from './errors';

describe('HttpError base class', () => {
	it('stores status and message', () => {
		const err = new HttpError(418, "I'm a teapot");
		expect(err.status).toBe(418);
		expect(err.message).toBe("I'm a teapot");
	});

	it('stores optional details', () => {
		const err = new HttpError(400, 'Bad', { field: 'title' });
		expect(err.details).toEqual({ field: 'title' });
	});

	it('details is undefined when not provided', () => {
		const err = new HttpError(400, 'Bad');
		expect(err.details).toBeUndefined();
	});

	it('is an instance of Error', () => {
		expect(new HttpError(500, 'oops')).toBeInstanceOf(Error);
	});
});

describe('HttpError subclasses', () => {
	it('BadRequest has status 400 and default message', () => {
		const err = new BadRequest();
		expect(err.status).toBe(400);
		expect(err.message).toBe('Bad request');
	});

	it('Unauthorized has status 401 and default message', () => {
		const err = new Unauthorized();
		expect(err.status).toBe(401);
		expect(err.message).toBe('Unauthorized');
	});

	it('Forbidden has status 403 and default message', () => {
		const err = new Forbidden();
		expect(err.status).toBe(403);
		expect(err.message).toBe('Forbidden');
	});

	it('NotFound has status 404 and default message', () => {
		const err = new NotFound();
		expect(err.status).toBe(404);
		expect(err.message).toBe('Not found');
	});

	it('UnprocessableEntity has status 422 and default message', () => {
		const err = new UnprocessableEntity();
		expect(err.status).toBe(422);
		expect(err.message).toBe('Validation failed');
	});

	it('accepts a custom message', () => {
		expect(new NotFound('Todo not found').message).toBe('Todo not found');
	});

	it('accepts details', () => {
		expect(new BadRequest('oops', { field: 'id' }).details).toEqual({ field: 'id' });
	});
});

describe('errorResponse(HttpError)', () => {
	it('returns the correct status code', () => {
		expect(errorResponse(new NotFound()).status).toBe(404);
	});

	it('returns body with error message when no details', () => {
		expect(errorResponse(new NotFound('Missing')).body).toEqual({ error: 'Missing' });
	});

	it('includes details in body when present', () => {
		const res = errorResponse(new BadRequest('Bad', { field: 'x' }));
		expect(res.body).toEqual({ error: 'Bad', details: { field: 'x' } });
	});
});

describe('errorResponse(unknown)', () => {
	let spy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		spy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		spy.mockRestore();
	});

	it('returns 500 for a non-HttpError', () => {
		const res = errorResponse(new Error('boom'));
		expect(res.status).toBe(500);
		expect(res.body).toEqual({ error: 'Internal server error' });
	});

	it('calls console.error with the original error', () => {
		const err = new Error('boom');
		errorResponse(err);
		expect(spy).toHaveBeenCalledWith(err);
	});

	it('returns 500 for non-Error values', () => {
		const res = errorResponse('plain string error');
		expect(res.status).toBe(500);
	});
});
