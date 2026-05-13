export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { subscribe } from '@/lib/appEvents';

const KEEPALIVE_MS = 25_000;

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (chunk) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      send(`retry: 5000\n\n`);
      send(`event: ready\ndata: {}\n\n`);

      const unsubscribe = subscribe((event) => {
        send(`event: notification\ndata: ${JSON.stringify(event)}\n\n`);
      });

      const ping = setInterval(() => send(`: keepalive\n\n`), KEEPALIVE_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try { controller.close(); } catch {}
      };

      controller.cleanup = cleanup;
    },
    cancel() {
      this.cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
