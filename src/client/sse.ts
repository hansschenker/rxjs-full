import { Observable } from 'rxjs';

export const fromEventSource = <T>(url: string, eventType: string): Observable<T> =>
	new Observable(observer => {
		const es = new EventSource(url);
		let closed = false;
		es.addEventListener(eventType, (e: MessageEvent) => {
			try {
				observer.next(JSON.parse(e.data) as T);
			} catch (err) {
				observer.error(err);
			}
		});
		es.onerror = () => {
			if (!closed) {
				closed = true;
				es.close();
				observer.error(new Error('EventSource error'));
			}
		};
		return () => {
			if (!closed) {
				closed = true;
				es.close();
			}
		};
	});
