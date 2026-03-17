import { notificationEmitter } from "@/lib/notification";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send the initial connection-success event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`),
      );

      // Listen for new notifications
      const onNotification = (notification: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(notification)}\n\n`),
          );
        } catch {
          doCleanup();
        }
      };

      notificationEmitter.on("notification", onNotification);

      // Keep the stream alive with a heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          doCleanup();
        }
      }, 30_000);

      const doCleanup = () => {
        clearInterval(heartbeat);
        notificationEmitter.removeListener("notification", onNotification);
      };

      cleanup = doCleanup;
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
