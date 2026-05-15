import type { HttpResponse } from './types';

export class HttpError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly details?: unknown,
	) {
		super(message);
	}
}

export class BadRequest extends HttpError {
	constructor(message = 'Bad request', details?: unknown) {
		super(400, message, details);
	}
}

export class Unauthorized extends HttpError {
	constructor(message = 'Unauthorized', details?: unknown) {
		super(401, message, details);
	}
}

export class Forbidden extends HttpError {
	constructor(message = 'Forbidden', details?: unknown) {
		super(403, message, details);
	}
}

export class NotFound extends HttpError {
	constructor(message = 'Not found', details?: unknown) {
		super(404, message, details);
	}
}

export class UnprocessableEntity extends HttpError {
	constructor(message = 'Validation failed', details?: unknown) {
		super(422, message, details);
	}
}

export const errorResponse = (err: unknown): HttpResponse => {
	if (err instanceof HttpError) {
		return {
			status: err.status,
			body: err.details === undefined
				? { error: err.message }
				: { error: err.message, details: err.details },
		};
	}

	console.error(err);
	return { status: 500, body: { error: 'Internal server error' } };
};
