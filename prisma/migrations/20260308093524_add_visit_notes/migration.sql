-- CreateTable
CREATE TABLE "VisitNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "subjective" TEXT NOT NULL DEFAULT '',
    "objective" TEXT NOT NULL DEFAULT '',
    "assessment" TEXT NOT NULL DEFAULT '',
    "plan" TEXT NOT NULL DEFAULT '',
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitNote_patientId_createdAt_idx" ON "VisitNote"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "VisitNote_providerId_createdAt_idx" ON "VisitNote"("providerId", "createdAt");

-- AddForeignKey
ALTER TABLE "VisitNote" ADD CONSTRAINT "VisitNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitNote" ADD CONSTRAINT "VisitNote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitNote" ADD CONSTRAINT "VisitNote_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
