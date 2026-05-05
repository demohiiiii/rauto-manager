CREATE TABLE "ManagerTemplate" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceAgentId" TEXT,
    "sourceAgentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagerTemplate_kind_name_key" ON "ManagerTemplate"("kind", "name");
CREATE INDEX "ManagerTemplate_kind_idx" ON "ManagerTemplate"("kind");
CREATE INDEX "ManagerTemplate_updatedAt_idx" ON "ManagerTemplate"("updatedAt");
