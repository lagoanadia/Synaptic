-- CreateTable
CREATE TABLE "DriveAgent" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "config" JSONB,
    "autoApply" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DriveAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveSource" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "course" TEXT,
    "placement" JSONB,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "outputId" TEXT,
    "error" TEXT,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DriveSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveChange" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "oldId" TEXT,
    "sourceId" TEXT,
    "undo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DriveChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriveAgent_tokenHash_key" ON "DriveAgent"("tokenHash");
CREATE UNIQUE INDEX "DriveAgent_userId_key" ON "DriveAgent"("userId");
CREATE UNIQUE INDEX "DriveSource_userId_sourceId_key" ON "DriveSource"("userId", "sourceId");
CREATE INDEX "DriveSource_userId_status_idx" ON "DriveSource"("userId", "status");
CREATE INDEX "DriveChange_userId_createdAt_idx" ON "DriveChange"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "DriveAgent" ADD CONSTRAINT "DriveAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriveSource" ADD CONSTRAINT "DriveSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriveChange" ADD CONSTRAINT "DriveChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
