-- CreateTable
CREATE TABLE "PatientUser" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "consentedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientUser_patientId_key" ON "PatientUser"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientUser_email_key" ON "PatientUser"("email");

-- CreateIndex
CREATE INDEX "PatientUser_email_idx" ON "PatientUser"("email");

-- AddForeignKey
ALTER TABLE "PatientUser" ADD CONSTRAINT "PatientUser_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
