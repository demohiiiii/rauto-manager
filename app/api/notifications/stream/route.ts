import { notificationEmitter } from "@/lib/notification";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 发送初始连接成功事件
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`),
      );

      // 监听新通知
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

      // 心跳保活（每 30 秒）
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
