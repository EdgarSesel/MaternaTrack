-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "onboardedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Handoff" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "fromProviderId" TEXT NOT NULL,
    "toProviderId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "openConcerns" TEXT,
    "pendingTasks" JSONB NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Handoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Handoff_toProviderId_acceptedAt_idx" ON "Handoff"("toProviderId", "acceptedAt");

-- CreateIndex
CREATE INDEX "Handoff_patientId_idx" ON "Handoff"("patientId");

-- AddForeignKey
ALTER TABLE "Handoff" ADD CONSTRAINT "Handoff_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handoff" ADD CONSTRAINT "Handoff_fromProviderId_fkey" FOREIGN KEY ("fromProviderId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handoff" ADD CONSTRAINT "Handoff_toProviderId_fkey" FOREIGN KEY ("toProviderId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
