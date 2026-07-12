// Type stubs for eventsource v2 (no bundled .d.ts)
declare module 'eventsource' {
  interface EventSourceOptions {
    headers?: Record<string, string>;
    proxy?: string;
    https?: Record<string, unknown>;
    rejectUnauthorized?: boolean;
    withCredentials?: boolean;
  }

  interface MessageEvent {
    type: string;
    data: string;
    lastEventId: string;
    origin: string;
  }

  type EventListener = (event: MessageEvent) => void;
  type ErrorListener = (event: Error) => void;

  class EventSource {
    constructor(url: string, options?: EventSourceOptions);
    readonly readyState: number;
    readonly url: string;
    onopen: (() => void) | null;
    onmessage: EventListener | null;
    onerror: ErrorListener | null;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
    close(): void;
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSED: number;
  }

  export = EventSource;
}
