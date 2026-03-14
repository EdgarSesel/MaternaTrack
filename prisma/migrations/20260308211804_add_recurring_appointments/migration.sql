-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "recurrenceEnd" TIMESTAMP(3),
ADD COLUMN     "recurrenceRule" TEXT,
ADD COLUMN     "seriesId" TEXT;

-- CreateIndex
CREATE INDEX "Appointment_seriesId_idx" ON "Appointment"("seriesId");
