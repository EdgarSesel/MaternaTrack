-- CreateTable
CREATE TABLE "Baby" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "firstName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "birthWeightGrams" INTEGER,
    "gestationalAgeAtBirth" INTEGER,
    "apgarScore1Min" INTEGER,
    "apgarScore5Min" INTEGER,
    "deliveryType" TEXT,
    "nicuAdmission" BOOLEAN NOT NULL DEFAULT false,
    "nicuDays" INTEGER,
    "feedingType" TEXT,
    "dischargedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Baby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeonatalVital" (
    "id" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NeonatalVital_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Baby_patientId_idx" ON "Baby"("patientId");

-- CreateIndex
CREATE INDEX "NeonatalVital_babyId_recordedAt_idx" ON "NeonatalVital"("babyId", "recordedAt");

-- AddForeignKey
ALTER TABLE "Baby" ADD CONSTRAINT "Baby_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeonatalVital" ADD CONSTRAINT "NeonatalVital_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby"("id") ON DELETE CASCADE ON UPDATE CASCADE;
