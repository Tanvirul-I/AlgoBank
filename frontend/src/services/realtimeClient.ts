export type MessageHandler<T> = (_payload: T) => void;

interface Subscription<T> {
	channel: string;
	handler: MessageHandler<T>;
}

export class RealtimeClient {
	private socket?: WebSocket;

	private subscriptions: Subscription<unknown>[] = [];

	private readonly url: string;

	constructor(url: string) {
		this.url = url;
	}

	connect() {
		if (this.socket) {
			return;
		}

		this.socket = new WebSocket(this.url);

		this.socket.addEventListener("message", (event) => {
			const message = JSON.parse(event.data.toString());

			this.subscriptions.forEach(({ channel, handler }) => {
				if (message.channel === channel) {
					handler(message.payload);
				}
			});
		});
	}

	disconnect() {
		this.socket?.close();
		this.socket = undefined;
	}

	subscribe<T>(channel: string, handler: MessageHandler<T>) {
		this.subscriptions.push({ channel, handler });
	}

	unsubscribe<T>(channel: string, handler: MessageHandler<T>) {
		this.subscriptions = this.subscriptions.filter(
			(subscription) =>
				!(subscription.channel === channel && subscription.handler === handler)
		);
	}
}
