import { PassThrough } from 'node:stream';
import type * as http from 'node:http';
import { BadRequestError, parseBody } from './http';

describe('parseBody()', () => {
	it('rejects when the request stream errors', async () => {
		const req = new PassThrough() as unknown as http.IncomingMessage;
		const result = parseBody(req);

		req.emit('error', new Error('boom'));

		await expect(result).rejects.toBeInstanceOf(BadRequestError);
	});
});
