-- CreateEnum
CREATE TYPE "ProviderRole" AS ENUM ('NURSE', 'MIDWIFE', 'OBGYN', 'DIETITIAN', 'THERAPIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('PRECONCEPTION', 'PREGNANT', 'POSTPARTUM', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'OVERDUE', 'SNOOZED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('PROVIDER', 'PATIENT', 'SYSTEM');

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "ProviderRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gestationalAgeWeeks" INTEGER,
    "dueDate" TIMESTAMP(3),
    "enrollmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PatientStatus" NOT NULL DEFAULT 'PREGNANT',
    "insuranceType" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "riskFactors" JSONB NOT NULL DEFAULT '[]',
    "socialDeterminants" JSONB NOT NULL DEFAULT '{}',
    "medicalHistory" JSONB NOT NULL DEFAULT '{}',
    "lastContactAt" TIMESTAMP(3),
    "lastContactChannel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vital" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screening" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "score" INTEGER,
    "riskResult" TEXT,
    "responses" JSONB NOT NULL DEFAULT '{}',
    "administeredAt" TIMESTAMP(3) NOT NULL,
    "administeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Screening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "protocolType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareTask" (
    "id" TEXT NOT NULL,
    "carePlanId" TEXT,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "snoozeUntil" TIMESTAMP(3),
    "snoozeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "senderType" "MessageSenderType" NOT NULL,
    "senderId" TEXT,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskScoreHistory" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "factors" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskScoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_email_key" ON "Provider"("email");

-- CreateIndex
CREATE INDEX "Patient_providerId_idx" ON "Patient"("providerId");

-- CreateIndex
CREATE INDEX "Patient_riskScore_idx" ON "Patient"("riskScore");

-- CreateIndex
CREATE INDEX "Patient_status_idx" ON "Patient"("status");

-- CreateIndex
CREATE INDEX "Patient_dueDate_idx" ON "Patient"("dueDate");

-- CreateIndex
CREATE INDEX "Vital_patientId_recordedAt_idx" ON "Vital"("patientId", "recordedAt");

-- CreateIndex
CREATE INDEX "Vital_patientId_type_idx" ON "Vital"("patientId", "type");

-- CreateIndex
CREATE INDEX "Screening_patientId_type_idx" ON "Screening"("patientId", "type");

-- CreateIndex
CREATE INDEX "CarePlan_patientId_idx" ON "CarePlan"("patientId");

-- CreateIndex
CREATE INDEX "CareTask_patientId_status_idx" ON "CareTask"("patientId", "status");

-- CreateIndex
CREATE INDEX "CareTask_status_dueDate_idx" ON "CareTask"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Message_patientId_createdAt_idx" ON "Message"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_patientId_createdAt_idx" ON "TimelineEvent"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "RiskScoreHistory_patientId_calculatedAt_idx" ON "RiskScoreHistory"("patientId", "calculatedAt");

-- CreateIndex
CREATE INDEX "Appointment_patientId_scheduledAt_idx" ON "Appointment"("patientId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Appointment_providerId_scheduledAt_idx" ON "Appointment"("providerId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vital" ADD CONSTRAINT "Vital_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screening" ADD CONSTRAINT "Screening_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_carePlanId_fkey" FOREIGN KEY ("carePlanId") REFERENCES "CarePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScoreHistory" ADD CONSTRAINT "RiskScoreHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
