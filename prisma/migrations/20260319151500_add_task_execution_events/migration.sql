-- CreateTable
CREATE TABLE "TaskExecutionEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentId" TEXT,
    "agentName" TEXT,
    "eventType" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "stage" TEXT,
    "message" TEXT NOT NULL,
    "progress" INTEGER,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskExecutionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskExecutionEvent_taskId_createdAt_idx" ON "TaskExecutionEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskExecutionEvent_eventType_idx" ON "TaskExecutionEvent"("eventType");

-- CreateIndex
CREATE INDEX "TaskExecutionEvent_createdAt_idx" ON "TaskExecutionEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "TaskExecutionEvent" ADD CONSTRAINT "TaskExecutionEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
