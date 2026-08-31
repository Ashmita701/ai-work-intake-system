-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('RECEIVED', 'ANALYSING', 'READY_FOR_REVIEW', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "WorkItemStatus" NOT NULL,
    "category" TEXT,
    "priority" TEXT,
    "summary" TEXT,
    "recommendedAction" TEXT,
    "analysisError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_externalId_key" ON "WorkItem"("externalId");
