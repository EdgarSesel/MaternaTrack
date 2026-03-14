-- CreateTable
CREATE TABLE "PatientAccess" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedById" TEXT,

    CONSTRAINT "PatientAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientAccess_providerId_idx" ON "PatientAccess"("providerId");

-- CreateIndex
CREATE INDEX "PatientAccess_patientId_idx" ON "PatientAccess"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientAccess_patientId_providerId_key" ON "PatientAccess"("patientId", "providerId");

-- AddForeignKey
ALTER TABLE "PatientAccess" ADD CONSTRAINT "PatientAccess_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAccess" ADD CONSTRAINT "PatientAccess_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
