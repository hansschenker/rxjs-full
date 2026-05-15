import { Observable } from 'rxjs';

export const fromEventSource = <T>(url: string, eventType: string): Observable<T> =>
	new Observable(observer => {
		const es = new EventSource(url);
		es.addEventListener(eventType, (e: MessageEvent) => {
			observer.next(JSON.parse(e.data) as T);
		});
		es.onerror = () => observer.error(new Error('EventSource error'));
		return () => es.close();
	});
