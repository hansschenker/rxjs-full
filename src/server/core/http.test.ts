import { PassThrough } from 'node:stream';
import type * as http from 'node:http';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { BadRequestError, applySse, formatSseChunk, parseBody } from './http';
import type { SseEvent } from './types';

describe('parseBody()', () => {
	it('rejects when the request stream errors', async () => {
		const req = new PassThrough() as unknown as http.IncomingMessage;
		const result = parseBody(req);

		req.emit('error', new Error('boom'));

		await expect(result).rejects.toBeInstanceOf(BadRequestError);
	});
});

describe('formatSseChunk()', () => {
	it('serialises data as JSON with trailing double newline', () => {
		expect(formatSseChunk({ data: { id: '1' } })).toBe('data: {"id":"1"}\n\n');
	});

	it('includes event field when present', () => {
		expect(formatSseChunk({ event: 'todos', data: [] })).toBe('event: todos\ndata: []\n\n');
	});

	it('includes id field before event and data', () => {
		expect(formatSseChunk({ id: '42', event: 'ping', data: null })).toBe('id: 42\nevent: ping\ndata: null\n\n');
	});
});

describe('applySse()', () => {
	it('writes a formatted chunk for each emission', () => {
		const source = new Subject<SseEvent>();
		const writes: string[] = [];
		const mockRes = { write: (chunk: string) => { writes.push(chunk); }, end: vi.fn() };
		const mockReq = { on: vi.fn() };

		applySse(source, mockReq, mockRes);
		source.next({ event: 'todos', data: [1, 2] });
		source.next({ data: 'ping' });

		expect(writes).toEqual(['event: todos\ndata: [1,2]\n\n', 'data: "ping"\n\n']);
		expect(mockRes.end).not.toHaveBeenCalled();
	});

	it('calls res.end() when the source completes', () => {
		const source = new Subject<SseEvent>();
		const mockRes = { write: vi.fn(), end: vi.fn() };
		const mockReq = { on: vi.fn() };

		applySse(source, mockReq, mockRes);
		source.complete();

		expect(mockRes.end).toHaveBeenCalledOnce();
	});

	it('calls res.end() when the source errors', () => {
		const source = new Subject<SseEvent>();
		const mockRes = { write: vi.fn(), end: vi.fn() };
		const mockReq = { on: vi.fn() };

		applySse(source, mockReq, mockRes);
		source.error(new Error('boom'));

		expect(mockRes.end).toHaveBeenCalledOnce();
	});

	it('stops writing after the client disconnects', () => {
		const source = new Subject<SseEvent>();
		const mockRes = { write: vi.fn(), end: vi.fn() };
		let closeHandler: (() => void) | undefined;
		const mockReq = { on: (_: string, handler: () => void) => { closeHandler = handler; } };

		applySse(source, mockReq, mockRes);
		closeHandler!();
		source.next({ data: 'after disconnect' });

		expect(mockRes.write).not.toHaveBeenCalled();
	});
});
