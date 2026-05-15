import { mergeMap, of, throwError } from 'rxjs';
import type { OperatorFunction } from 'rxjs';
import { z, type ZodType } from 'zod';
import type { HttpRequest } from './types';
import { UnprocessableEntity } from './errors';

export type ValidationTarget = 'body' | 'params' | 'query';

export class ValidationError extends UnprocessableEntity {
	constructor(target: ValidationTarget, public readonly issues: z.core.$ZodIssue[]) {
		super('Validation failed', { target, issues });
	}
}

const validateTarget = <T, K extends ValidationTarget>(
	target: K,
	schema: ZodType<T>,
): OperatorFunction<HttpRequest, HttpRequest & Record<K, T>> =>
	mergeMap(req => {
		const result = schema.safeParse(req[target]);
		return result.success
			? of({ ...req, [target]: result.data } as HttpRequest & Record<K, T>)
			: throwError(() => new ValidationError(target, result.error.issues));
	});

export const validateBody = <T>(schema: ZodType<T>): OperatorFunction<HttpRequest, HttpRequest & { body: T }> =>
	validateTarget('body', schema);

export const validateParams = <T extends Record<string, string>>(
	schema: ZodType<T>,
): OperatorFunction<HttpRequest, HttpRequest & { params: T }> =>
	validateTarget('params', schema);

export const validateQuery = <T extends Record<string, string>>(
	schema: ZodType<T>,
): OperatorFunction<HttpRequest, HttpRequest & { query: T }> =>
	validateTarget('query', schema);

export const validate = validateBody;
