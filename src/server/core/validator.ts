// Idea 4: Validation as OperatorFunction with proper type narrowing
// Unlike Marble.js, the body type propagates correctly — no casts downstream.

import * as t from 'io-ts';
import { isRight } from 'fp-ts/Either';
import { mergeMap, of, throwError } from 'rxjs';
import type { OperatorFunction } from 'rxjs';
import type { HttpRequest } from './types';

export class ValidationError extends Error {
	constructor(public readonly errors: t.Errors) {
		super('Validation failed');
	}
}

// After validate(codec), TypeScript knows req.body is T — no cast needed.
export const validate = <T>(
	codec: t.Type<T>,
): OperatorFunction<HttpRequest, HttpRequest & { body: T }> =>
	mergeMap(req => {
		const result = codec.decode(req.body);
		return isRight(result)
			? of({ ...req, body: result.right } as HttpRequest & { body: T })
			: throwError(() => new ValidationError(result.left));
	});
