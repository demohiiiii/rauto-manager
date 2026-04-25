ALTER TABLE "Agent"
DROP COLUMN "activeSessions";

ALTER TABLE "Task"
ADD COLUMN "resultSummary" TEXT;
