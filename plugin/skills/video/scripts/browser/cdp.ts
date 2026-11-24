/**
 * @fileoverview A small Chrome DevTools Protocol client. It uses the
 * WebSocket and fetch built into Node, so nothing is installed.
 */

/** Options for {@link CdpSession.shot}. */
export interface ShotOptions {
  /** Image format. Default `jpeg`. */
  format?: 'jpeg' | 'png';
  /** JPEG quality from 0 to 100. Default 92. Ignored for PNG. */
  quality?: number;
}

interface CdpMessage {
  id?: number;
  result?: unknown;
  error?: {message: string};
  method?: string;
  params?: CdpParams;
}

interface RemoteObject {
  value?: unknown;
  description?: string;
}

interface ExceptionDetails {
  text: string;
  exception?: RemoteObject;
}

interface CdpParams {
  exceptionDetails?: ExceptionDetails;
  type?: string;
  args?: RemoteObject[];
  entry?: {level: string; text: string; url?: string};
}

interface Pending {
  resolve(result: unknown): void;
  reject(error: Error): void;
  method: string;
}

interface EvalResult {
  result: RemoteObject;
  exceptionDetails?: ExceptionDetails;
}

function describeException(d: ExceptionDetails): string {
  return d.exception?.description ?? d.text;
}

/**
 * One DevTools Protocol connection to one browser page.
 * It collects page errors (uncaught exceptions, `console.error` calls and
 * failed resource loads) in {@link CdpSession.errors}.
 */
export class CdpSession {
  /** Messages of page errors seen so far, oldest first. */
  readonly errors: string[] = [];
  private readonly ws: WebSocket;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener('message', ev => this.onMessage(String(ev.data)));
    ws.addEventListener('close', () => this.onClose());
  }

  private onMessage(raw: string): void {
    const m = JSON.parse(raw) as CdpMessage;
    const waiting = m.id === undefined ? undefined : this.pending.get(m.id);
    if (m.id !== undefined && waiting) {
      this.pending.delete(m.id);
      if (m.error) {
        waiting.reject(new Error(`${waiting.method}: ${m.error.message}`));
      } else {
        waiting.resolve(m.result);
      }
    } else if (m.method && m.params) {
      this.onEvent(m.method, m.params);
    }
  }

  private onEvent(method: string, p: CdpParams): void {
    if (method === 'Runtime.exceptionThrown' && p.exceptionDetails) {
      this.errors.push(describeException(p.exceptionDetails));
    } else if (method === 'Runtime.consoleAPICalled' && p.type === 'error') {
      const parts = (p.args ?? []).map(a => a.value ?? a.description ?? '');
      this.errors.push(parts.join(' '));
    } else if (method === 'Log.entryAdded' && p.entry?.level === 'error') {
      this.errors.push(`${p.entry.text} ${p.entry.url ?? ''}`.trim());
    }
  }

  private onClose(): void {
    for (const {reject, method} of this.pending.values()) {
      reject(new Error(`browser connection closed during ${method}`));
    }
    this.pending.clear();
  }

  /**
   * Sends one protocol command.
   *
   * @param method Command name, such as `Page.navigate`.
   * @returns The command's `result` object.
   */
  send(method: string, params: object = {}): Promise<unknown> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject, method});
      this.ws.send(JSON.stringify({id, method, params}));
    });
  }

  /**
   * Evaluates a JavaScript expression in the page. Promises are awaited.
   *
   * @returns The value, copied through JSON.
   * @throws Error when the page code throws.
   */
  async eval(expression: string): Promise<unknown> {
    const r = (await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })) as EvalResult;
    if (r.exceptionDetails) {
      throw new Error(`page error: ${describeException(r.exceptionDetails)}`);
    }
    return r.result.value;
  }

  /** Takes a screenshot of the viewport. Returns the encoded image bytes. */
  async shot(options: ShotOptions = {}): Promise<Buffer> {
    const png = options.format === 'png';
    const params = png
      ? {format: 'png', optimizeForSpeed: true}
      : {format: 'jpeg', quality: options.quality ?? 92};
    const r = (await this.send('Page.captureScreenshot', params)) as {
      data: string;
    };
    return Buffer.from(r.data, 'base64');
  }

  /** Closes the connection. The browser process keeps running. */
  close(): void {
    try {
      this.ws.close();
    } catch {
      // The socket is already closed.
    }
  }
}
