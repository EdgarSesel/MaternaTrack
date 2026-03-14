import "dotenv/config";
import { PrismaClient, ProviderRole, PatientStatus, RiskLevel, TaskStatus, MessageSenderType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { subDays, subWeeks, addWeeks, addDays } from "date-fns";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const NOW = new Date();

function daysAgo(n: number) {
  return subDays(NOW, n);
}

function weeksAgo(n: number) {
  return subWeeks(NOW, n);
}

function weeksFromNow(n: number) {
  return addWeeks(NOW, n);
}

function daysFromNow(n: number) {
  return addDays(NOW, n);
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.patientUser.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.message.deleteMany();
  await prisma.careTask.deleteMany();
  await prisma.carePlan.deleteMany();
  await prisma.screening.deleteMany();
  await prisma.vital.deleteMany();
  await prisma.riskScoreHistory.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.provider.deleteMany();

  // --- PROVIDERS ---
  const nurseHash = await hashPassword("password123");
  const midwifeHash = await hashPassword("password123");
  const adminHash = await hashPassword("password123");

  const nurse = await prisma.provider.create({
    data: {
      email: "nurse@materna.dev",
      passwordHash: nurseHash,
      name: "Jessica Chen",
      role: ProviderRole.NURSE,
    },
  });

  const midwife = await prisma.provider.create({
    data: {
      email: "midwife@materna.dev",
      passwordHash: midwifeHash,
      name: "Sarah Williams",
      role: ProviderRole.MIDWIFE,
    },
  });

  const admin = await prisma.provider.create({
    data: {
      email: "admin@materna.dev",
      passwordHash: adminHash,
      name: "Dr. Michael Torres",
      role: ProviderRole.ADMIN,
    },
  });

  console.log("Providers created.");

  // --- ARCHETYPE 1: Sarah — High-Risk Preeclampsia ---
  const sarah = await prisma.patient.create({
    data: {
      providerId: nurse.id,
      firstName: "Sarah",
      lastName: "Mitchell",
      dateOfBirth: new Date("1985-03-15"),
      gestationalAgeWeeks: 32,
      dueDate: weeksFromNow(8),
      status: PatientStatus.PREGNANT,
      insuranceType: "Blue Cross PPO",
      riskScore: 72,
      riskLevel: RiskLevel.HIGH,
      riskFactors: [
        { factor: "age", score: 5, weight: 5, trend: "stable" },
        { factor: "bmi", score: 3, weight: 5, trend: "stable" },
        { factor: "bloodPressureTrend", score: 10, weight: 10, trend: "worsening" },
        { factor: "appointmentAdherence", score: 4, weight: 7, trend: "stable" },
        { factor: "depressionScreening", score: 2, weight: 7, trend: "stable" },
      ],
      medicalHistory: {
        bmi: 33,
        previousPreterm: false,
        previousCSection: false,
        preexistingConditions: ["chronic_hypertension"],
        medications: ["aspirin_81mg"],
        allergies: [],
      },
      socialDeterminants: {
        housingInstability: false,
        foodInsecurity: false,
        transportationBarrier: false,
        socialIsolation: false,
        intimatePartnerViolence: false,
      },
      lastContactAt: daysAgo(2),
      lastContactChannel: "message",
    },
  });

  // Sarah's BP vitals — trending upward
  await prisma.vital.createMany({
    data: [
      { patientId: sarah.id, type: "bp", value: { systolic: 118, diastolic: 76 }, recordedAt: weeksAgo(4), source: "patient_reported" },
      { patientId: sarah.id, type: "bp", value: { systolic: 128, diastolic: 82 }, recordedAt: weeksAgo(3), source: "patient_reported" },
      { patientId: sarah.id, type: "bp", value: { systolic: 136, diastolic: 88 }, recordedAt: weeksAgo(2), source: "patient_reported" },
      { patientId: sarah.id, type: "bp", value: { systolic: 142, diastolic: 92 }, recordedAt: weeksAgo(1), source: "patient_reported" },
      { patientId: sarah.id, type: "weight", value: { value: 178, unit: "lbs" }, recordedAt: weeksAgo(2), source: "patient_reported" },
      { patientId: sarah.id, type: "weight", value: { value: 181, unit: "lbs" }, recordedAt: weeksAgo(1), source: "patient_reported" },
    ],
  });

  // Sarah's screenings
  await prisma.screening.create({
    data: {
      patientId: sarah.id,
      type: "phq9",
      score: 6,
      riskResult: "mild",
      responses: { q1: 1, q2: 1, q3: 0, q4: 2, q5: 0, q6: 1, q7: 0, q8: 0, q9: 0 },
      administeredAt: weeksAgo(3),
    },
  });

  // Sarah's care plan — preeclampsia prevention
  const sarahPlan = await prisma.carePlan.create({
    data: {
      patientId: sarah.id,
      protocolType: "preeclampsia_prevention",
      status: "active",
      config: { aspirinDose: "81mg", bpThresholds: { systolic: 140, diastolic: 90 } },
    },
  });

  await prisma.careTask.createMany({
    data: [
      { carePlanId: sarahPlan.id, patientId: sarah.id, title: "Daily BP log check", description: "Review patient-reported BP readings for escalation threshold", dueDate: daysAgo(1), status: TaskStatus.OVERDUE, priority: "urgent" },
      { carePlanId: sarahPlan.id, patientId: sarah.id, title: "Consult OB re: BP trend", description: "BP has risen to 142/92 — discuss escalation of monitoring", dueDate: daysAgo(2), status: TaskStatus.OVERDUE, priority: "urgent" },
      { carePlanId: sarahPlan.id, patientId: sarah.id, title: "Aspirin adherence check", description: "Confirm patient is taking aspirin 81mg daily", dueDate: daysFromNow(1), status: TaskStatus.PENDING, priority: "high" },
      { carePlanId: sarahPlan.id, patientId: sarah.id, title: "32-week anatomy check follow-up", description: "Review results from 32-week ultrasound", dueDate: daysFromNow(3), status: TaskStatus.PENDING, priority: "normal" },
    ],
  });

  await prisma.message.createMany({
    data: [
      { patientId: sarah.id, senderType: MessageSenderType.PROVIDER, senderId: nurse.id, content: "Hi Sarah! I noticed your blood pressure has been trending up this week. How are you feeling?", createdAt: daysAgo(3) },
      { patientId: sarah.id, senderType: MessageSenderType.PATIENT, content: "Hi Jessica! I've been having some headaches and my feet seem a bit swollen. Is that normal?", createdAt: daysAgo(3) },
      { patientId: sarah.id, senderType: MessageSenderType.PROVIDER, senderId: nurse.id, content: "Those symptoms are important to monitor. Please take your BP again today and let me know the reading right away.", createdAt: daysAgo(2) },
      { patientId: sarah.id, senderType: MessageSenderType.PATIENT, content: "Just checked: 142/92. Is this bad?", createdAt: daysAgo(2) },
    ],
  });

  await prisma.timelineEvent.createMany({
    data: [
      { patientId: sarah.id, eventType: "vital_recorded", title: "BP recorded: 142/92", description: "Systolic crossed 140 threshold", createdAt: weeksAgo(1) },
      { patientId: sarah.id, eventType: "vital_recorded", title: "BP recorded: 136/88", createdAt: weeksAgo(2) },
      { patientId: sarah.id, eventType: "vital_recorded", title: "BP recorded: 128/82", createdAt: weeksAgo(3) },
      { patientId: sarah.id, eventType: "risk_change", title: "Risk score increased to HIGH (72)", description: "Escalating BP trend triggered risk recalculation", createdAt: weeksAgo(1) },
      { patientId: sarah.id, eventType: "screening_completed", title: "PHQ-9 completed — score 6 (mild)", createdAt: weeksAgo(3) },
      { patientId: sarah.id, eventType: "care_plan_update", title: "Preeclampsia prevention protocol activated", createdAt: weeksAgo(8) },
    ],
  });

  // --- ARCHETYPE 2: Maria — GDM Management Success ---
  const maria = await prisma.patient.create({
    data: {
      providerId: nurse.id,
      firstName: "Maria",
      lastName: "Rodriguez",
      dateOfBirth: new Date("1994-07-22"),
      gestationalAgeWeeks: 28,
      dueDate: weeksFromNow(12),
      status: PatientStatus.PREGNANT,
      insuranceType: "Medicaid",
      riskScore: 45,
      riskLevel: RiskLevel.MODERATE,
      riskFactors: [
        { factor: "glucoseStatus", score: 8, weight: 8, trend: "improving" },
        { factor: "bmi", score: 3, weight: 5, trend: "stable" },
        { factor: "depressionScreening", score: 2, weight: 7, trend: "stable" },
      ],
      medicalHistory: {
        bmi: 29,
        previousPreterm: false,
        previousCSection: false,
        preexistingConditions: ["gestational_diabetes"],
        medications: ["metformin"],
        gdmDiagnosedAt: weeksAgo(4).toISOString(),
      },
      socialDeterminants: {
        housingInstability: false,
        foodInsecurity: false,
        transportationBarrier: false,
        socialIsolation: false,
        intimatePartnerViolence: false,
      },
      lastContactAt: daysAgo(1),
      lastContactChannel: "message",
    },
  });

  await prisma.vital.createMany({
    data: [
      { patientId: maria.id, type: "glucose", value: { value: 148, unit: "mg/dL", fasting: true }, recordedAt: weeksAgo(4), source: "patient_reported" },
      { patientId: maria.id, type: "glucose", value: { value: 132, unit: "mg/dL", fasting: true }, recordedAt: weeksAgo(3), source: "patient_reported" },
      { patientId: maria.id, type: "glucose", value: { value: 118, unit: "mg/dL", fasting: true }, recordedAt: weeksAgo(2), source: "patient_reported" },
      { patientId: maria.id, type: "glucose", value: { value: 105, unit: "mg/dL", fasting: true }, recordedAt: weeksAgo(1), source: "patient_reported" },
      { patientId: maria.id, type: "bp", value: { systolic: 112, diastolic: 70 }, recordedAt: weeksAgo(1), source: "patient_reported" },
    ],
  });

  await prisma.screening.createMany({
    data: [
      { patientId: maria.id, type: "phq9", score: 6, riskResult: "mild", responses: {}, administeredAt: weeksAgo(2) },
      { patientId: maria.id, type: "gdm_screen", score: null, riskResult: "positive", responses: { result: "diagnosed" }, administeredAt: weeksAgo(4) },
    ],
  });

  const mariaPlan = await prisma.carePlan.create({
    data: {
      patientId: maria.id,
      protocolType: "gdm_management",
      status: "active",
      config: { targetFastingGlucose: 95, targetPostprandialGlucose: 120 },
    },
  });

  await prisma.careTask.createMany({
    data: [
      { carePlanId: mariaPlan.id, patientId: maria.id, title: "Weekly glucose log review", dueDate: daysFromNow(2), status: TaskStatus.PENDING, priority: "high" },
      { carePlanId: mariaPlan.id, patientId: maria.id, title: "Dietitian follow-up", description: "Review dietary changes and meal plan adherence", dueDate: daysFromNow(5), status: TaskStatus.PENDING, priority: "normal" },
      { carePlanId: mariaPlan.id, patientId: maria.id, title: "28-week lab review", description: "HbA1c and glucose tolerance", dueDate: daysFromNow(7), status: TaskStatus.PENDING, priority: "normal" },
      { carePlanId: mariaPlan.id, patientId: maria.id, title: "Dietary assessment completed", dueDate: weeksAgo(3), status: TaskStatus.COMPLETED, priority: "normal", completedAt: weeksAgo(3), completedBy: nurse.id },
      { carePlanId: mariaPlan.id, patientId: maria.id, title: "GDM education session", dueDate: weeksAgo(4), status: TaskStatus.COMPLETED, priority: "normal", completedAt: weeksAgo(4), completedBy: nurse.id },
    ],
  });

  await prisma.message.createMany({
    data: [
      { patientId: maria.id, senderType: MessageSenderType.PATIENT, content: "Good morning! Just logged my fasting glucose: 105 today! Down from 148 last month!", createdAt: daysAgo(1) },
      { patientId: maria.id, senderType: MessageSenderType.PROVIDER, senderId: nurse.id, content: "That's fantastic progress, Maria! You're doing an amazing job with the dietary changes. Keep it up!", createdAt: daysAgo(1) },
      { patientId: maria.id, senderType: MessageSenderType.PATIENT, content: "Thank you! The dietitian's meal plan has really helped. Question — can I eat quinoa?", createdAt: daysAgo(1) },
    ],
  });

  // --- ARCHETYPE 3: Aisha — Disengaged High-Risk ---
  const aisha = await prisma.patient.create({
    data: {
      providerId: nurse.id,
      firstName: "Aisha",
      lastName: "Johnson",
      dateOfBirth: new Date("2001-11-08"),
      gestationalAgeWeeks: 24,
      dueDate: weeksFromNow(16),
      status: PatientStatus.PREGNANT,
      insuranceType: "Medicaid",
      riskScore: 78,
      riskLevel: RiskLevel.VERY_HIGH,
      riskFactors: [
        { factor: "previousPreterm", score: 8, weight: 8, trend: "stable" },
        { factor: "daysSinceLastContact", score: 6, weight: 6, trend: "worsening" },
        { factor: "depressionScreening", score: 5, weight: 7, trend: "worsening" },
        { factor: "appointmentAdherence", score: 7, weight: 7, trend: "worsening" },
        { factor: "foodInsecurity", score: 5, weight: 5, trend: "stable" },
        { factor: "transportationBarrier", score: 4, weight: 4, trend: "stable" },
        { factor: "careTaskCompletion", score: 7, weight: 7, trend: "worsening" },
      ],
      medicalHistory: {
        bmi: 24,
        previousPreterm: true,
        previousCSection: false,
        preexistingConditions: [],
        medications: [],
        previousPregnancyOutcome: "preterm_28w",
      },
      socialDeterminants: {
        housingInstability: false,
        foodInsecurity: true,
        transportationBarrier: true,
        socialIsolation: true,
        intimatePartnerViolence: false,
      },
      lastContactAt: daysAgo(12),
      lastContactChannel: "message",
    },
  });

  await prisma.vital.createMany({
    data: [
      { patientId: aisha.id, type: "bp", value: { systolic: 110, diastolic: 70 }, recordedAt: weeksAgo(6), source: "manual" },
      { patientId: aisha.id, type: "weight", value: { value: 142, unit: "lbs" }, recordedAt: weeksAgo(6), source: "manual" },
    ],
  });

  await prisma.screening.create({
    data: {
      patientId: aisha.id,
      type: "phq9",
      score: 14,
      riskResult: "moderate_severe",
      responses: {},
      administeredAt: weeksAgo(3),
    },
  });

  const aishaPlan = await prisma.carePlan.create({
    data: {
      patientId: aisha.id,
      protocolType: "standard_prenatal",
      status: "active",
      config: {},
    },
  });

  await prisma.careTask.createMany({
    data: [
      { carePlanId: aishaPlan.id, patientId: aisha.id, title: "PHQ-9 follow-up", description: "Score was 14 — needs mental health referral or follow-up", dueDate: daysAgo(7), status: TaskStatus.OVERDUE, priority: "urgent" },
      { carePlanId: aishaPlan.id, patientId: aisha.id, title: "Missed appointment follow-up", description: "Patient missed 24-week prenatal visit", dueDate: daysAgo(5), status: TaskStatus.OVERDUE, priority: "high" },
      { carePlanId: aishaPlan.id, patientId: aisha.id, title: "Re-engage outreach call", description: "No response to messages for 12 days", dueDate: daysAgo(2), status: TaskStatus.OVERDUE, priority: "urgent" },
      { carePlanId: aishaPlan.id, patientId: aisha.id, title: "Food insecurity resource referral", description: "Connect patient with WIC and local food bank", dueDate: daysAgo(10), status: TaskStatus.OVERDUE, priority: "high" },
      { carePlanId: aishaPlan.id, patientId: aisha.id, title: "Transportation assistance", description: "Help patient find ride assistance for appointments", dueDate: daysFromNow(3), status: TaskStatus.PENDING, priority: "high" },
    ],
  });

  await prisma.message.createMany({
    data: [
      { patientId: aisha.id, senderType: MessageSenderType.PROVIDER, senderId: nurse.id, content: "Hi Aisha! We missed you at your appointment yesterday. Hope you're doing okay — can you give us a call when you get a chance?", createdAt: daysAgo(12) },
      { patientId: aisha.id, senderType: MessageSenderType.PROVIDER, senderId: nurse.id, content: "Aisha, checking in again. We want to make sure you and the baby are doing well. Is there anything we can help with to make it easier to come in?", createdAt: daysAgo(8) },
      { patientId: aisha.id, senderType: MessageSenderType.SYSTEM, content: "Message delivery confirmed — read receipt not returned", createdAt: daysAgo(8) },
    ],
  });

  await prisma.timelineEvent.createMany({
    data: [
      { patientId: aisha.id, eventType: "escalation", title: "Patient disengaged — no response for 12 days", createdAt: daysAgo(1) },
      { patientId: aisha.id, eventType: "screening_completed", title: "PHQ-9: Score 14 (moderately severe)", createdAt: weeksAgo(3) },
      { patientId: aisha.id, eventType: "risk_change", title: "Risk escalated to VERY HIGH (78)", createdAt: daysAgo(5) },
    ],
  });

  // --- ARCHETYPE 4: Jennifer — Low-Risk Routine ---
  const jennifer = await prisma.patient.create({
    data: {
      providerId: nurse.id,
      firstName: "Jennifer",
      lastName: "Park",
      dateOfBirth: new Date("1993-04-12"),
      gestationalAgeWeeks: 16,
      dueDate: weeksFromNow(24),
      status: PatientStatus.PREGNANT,
      insuranceType: "Aetna PPO",
      riskScore: 12,
      riskLevel: RiskLevel.LOW,
      riskFactors: [],
      medicalHistory: {
        bmi: 24,
        previousPreterm: false,
        previousCSection: false,
        preexistingConditions: [],
        medications: ["prenatal_vitamins"],
        parity: 1,
      },
      socialDeterminants: {
        housingInstability: false,
        foodInsecurity: false,
        transportationBarrier: false,
        socialIsolation: false,
        intimatePartnerViolence: false,
      },
      lastContactAt: daysAgo(3),
      lastContactChannel: "message",
    },
  });

  await prisma.vital.createMany({
    data: [
      { patientId: jennifer.id, type: "bp", value: { systolic: 110, diastolic: 68 }, recordedAt: weeksAgo(1), source: "manual" },
      { patientId: jennifer.id, type: "weight", value: { value: 138, unit: "lbs" }, recordedAt: weeksAgo(1), source: "manual" },
    ],
  });

  await prisma.screening.createMany({
    data: [
      { patientId: jennifer.id, type: "phq9", score: 2, riskResult: "minimal", responses: {}, administeredAt: weeksAgo(4) },
      { patientId: jennifer.id, type: "sdoh", score: null, riskResult: "low", responses: { housing: "stable", food: "stable", transportation: "stable" }, administeredAt: weeksAgo(4) },
    ],
  });

  const jenniferPlan = await prisma.carePlan.create({
    data: {
      patientId: jennifer.id,
      protocolType: "standard_prenatal",
      status: "active",
      config: {},
    },
  });

  await prisma.careTask.createMany({
    data: [
      { carePlanId: jenniferPlan.id, patientId: jennifer.id, title: "20-week anatomy scan", dueDate: weeksFromNow(4), status: TaskStatus.PENDING, priority: "normal" },
      { carePlanId: jenniferPlan.id, patientId: jennifer.id, title: "16-week prenatal visit", dueDate: daysFromNow(7), status: TaskStatus.PENDING, priority: "normal" },
      { carePlanId: jenniferPlan.id, patientId: jennifer.id, title: "GDM screening at 24-28 weeks", dueDate: weeksFromNow(8), status: TaskStatus.PENDING, priority: "normal" },
      { carePlanId: jenniferPlan.id, patientId: jennifer.id, title: "First trimester screening", dueDate: weeksAgo(4), status: TaskStatus.COMPLETED, priority: "normal", completedAt: weeksAgo(4), completedBy: nurse.id },
    ],
  });

  await prisma.message.createMany({
    data: [
      { patientId: jennifer.id, senderType: MessageSenderType.PATIENT, content: "Hi! Quick question — is it normal to feel the baby move at 16 weeks?", createdAt: daysAgo(3) },
      { patientId: jennifer.id, senderType: MessageSenderType.PROVIDER, senderId: nurse.id, content: "Yes, absolutely! Feeling movement (quickening) around 16-20 weeks for a second pregnancy is completely normal. Enjoy it! 🌟", createdAt: daysAgo(3) },
    ],
  });

  // --- ARCHETYPE 5: Keiko — Postpartum NICU Family ---
  const keiko = await prisma.patient.create({
    data: {
      providerId: nurse.id,
      firstName: "Keiko",
      lastName: "Tanaka",
      dateOfBirth: new Date("1990-09-05"),
      gestationalAgeWeeks: null,
      dueDate: null,
      status: PatientStatus.POSTPARTUM,
      insuranceType: "United Healthcare",
      riskScore: 55,
      riskLevel: RiskLevel.HIGH,
      riskFactors: [
        { factor: "depressionScreening", score: 7, weight: 7, trend: "worsening" },
        { factor: "daysSinceLastContact", score: 3, weight: 6, trend: "stable" },
      ],
      medicalHistory: {
        deliveredAt: daysAgo(21).toISOString(),
        gestationalAgeAtDelivery: 34,
        deliveryType: "vaginal",
        babyInNICU: false,
        nicuDuration: 14,
        babyHomeDate: daysAgo(7).toISOString(),
        babyWeight: { value: 4.8, unit: "lbs" },
        preexistingConditions: [],
        medications: [],
      },
      socialDeterminants: {
        housingInstability: false,
        foodInsecurity: false,
        transportationBarrier: false,
        socialIsolation: true,
        intimatePartnerViolence: false,
      },
      lastContactAt: daysAgo(4),
      lastContactChannel: "message",
    },
  });

  await prisma.vital.createMany({
    data: [
      { patientId: keiko.id, type: "bp", value: { systolic: 118, diastolic: 74 }, recordedAt: daysAgo(7), source: "patient_reported" },
    ],
  });

  const keikoPlan = await prisma.carePlan.create({
    data: {
      patientId: keiko.id,
      protocolType: "standard_prenatal",
      status: "active",
      config: { postpartum: true },
    },
  });

  await prisma.careTask.createMany({
    data: [
      { carePlanId: keikoPlan.id, patientId: keiko.id, title: "EPDS postpartum depression screening", description: "Overdue — patient delivered 3 weeks ago, no postpartum screening completed", dueDate: daysAgo(7), status: TaskStatus.OVERDUE, priority: "urgent" },
      { carePlanId: keikoPlan.id, patientId: keiko.id, title: "3-week postpartum check-in", description: "How is baby feeding? Sleep? Support system?", dueDate: daysAgo(1), status: TaskStatus.OVERDUE, priority: "high" },
      { carePlanId: keikoPlan.id, patientId: keiko.id, title: "Baby weight check follow-up", description: "Premature baby — confirm adequate weight gain at home", dueDate: daysFromNow(2), status: TaskStatus.PENDING, priority: "high" },
    ],
  });

  await prisma.message.createMany({
    data: [
      { patientId: keiko.id, senderType: MessageSenderType.PATIENT, content: "Baby Hana is finally home! We're exhausted but so relieved. The NICU team was amazing.", createdAt: daysAgo(7) },
      { patientId: keiko.id, senderType: MessageSenderType.PROVIDER, senderId: nurse.id, content: "Congratulations Keiko! So happy to hear Hana is home. How are YOU doing? Make sure to rest too — you've been through a lot.", createdAt: daysAgo(7) },
      { patientId: keiko.id, senderType: MessageSenderType.PATIENT, content: "Honestly? I'm struggling a bit. I keep worrying about every little thing with the baby. Is this normal?", createdAt: daysAgo(4) },
    ],
  });

  await prisma.timelineEvent.createMany({
    data: [
      { patientId: keiko.id, eventType: "task_completed", title: "Baby discharged from NICU", createdAt: daysAgo(7) },
      { patientId: keiko.id, eventType: "escalation", title: "Postpartum screening overdue — 21 days post delivery", createdAt: daysAgo(1) },
    ],
  });

  // --- ADDITIONAL PATIENTS (25 for nurse, 15 for midwife, 5 for admin) ---
  const firstNames = ["Emma", "Olivia", "Ava", "Isabella", "Sophia", "Mia", "Charlotte", "Amelia", "Harper", "Evelyn", "Abigail", "Emily", "Ella", "Elizabeth", "Camila", "Luna", "Sofia", "Avery", "Mila", "Aria", "Scarlett", "Penelope", "Layla", "Chloe", "Victoria"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark"];

  const riskDistribution: { score: number; level: RiskLevel }[] = [
    { score: 8, level: RiskLevel.LOW },
    { score: 15, level: RiskLevel.LOW },
    { score: 22, level: RiskLevel.LOW },
    { score: 10, level: RiskLevel.LOW },
    { score: 18, level: RiskLevel.LOW },
    { score: 30, level: RiskLevel.MODERATE },
    { score: 38, level: RiskLevel.MODERATE },
    { score: 42, level: RiskLevel.MODERATE },
    { score: 35, level: RiskLevel.MODERATE },
    { score: 47, level: RiskLevel.MODERATE },
    { score: 32, level: RiskLevel.MODERATE },
    { score: 55, level: RiskLevel.HIGH },
    { score: 62, level: RiskLevel.HIGH },
    { score: 58, level: RiskLevel.HIGH },
    { score: 68, level: RiskLevel.HIGH },
    { score: 70, level: RiskLevel.HIGH },
    { score: 65, level: RiskLevel.HIGH },
    { score: 80, level: RiskLevel.VERY_HIGH },
    { score: 76, level: RiskLevel.VERY_HIGH },
    { score: 85, level: RiskLevel.VERY_HIGH },
    { score: 25, level: RiskLevel.LOW },
    { score: 44, level: RiskLevel.MODERATE },
    { score: 60, level: RiskLevel.HIGH },
    { score: 12, level: RiskLevel.LOW },
    { score: 33, level: RiskLevel.MODERATE },
  ];

  const statuses = [PatientStatus.PREGNANT, PatientStatus.PREGNANT, PatientStatus.PREGNANT, PatientStatus.POSTPARTUM, PatientStatus.PRECONCEPTION];

  // Generate 25 more nurse patients
  for (let i = 0; i < 25; i++) {
    const risk = riskDistribution[i];
    const status = statuses[i % statuses.length];
    const ga = status === PatientStatus.PREGNANT ? randomBetween(8, 36) : null;
    const dob = new Date(Date.now() - randomBetween(22, 42) * 365.25 * 24 * 3600 * 1000);
    const lastContact = daysAgo(randomBetween(0, 21));

    await prisma.patient.create({
      data: {
        providerId: nurse.id,
        firstName: firstNames[i],
        lastName: lastNames[i],
        dateOfBirth: dob,
        gestationalAgeWeeks: ga,
        dueDate: ga ? weeksFromNow(40 - ga) : null,
        status,
        insuranceType: ["Medicaid", "Blue Cross PPO", "Aetna", "United Healthcare", "Cigna"][i % 5],
        riskScore: risk.score,
        riskLevel: risk.level,
        riskFactors: [],
        medicalHistory: { bmi: randomBetween(20, 36), preexistingConditions: [] },
        socialDeterminants: {
          housingInstability: risk.score > 60,
          foodInsecurity: risk.score > 70,
          transportationBarrier: risk.score > 65,
          socialIsolation: false,
          intimatePartnerViolence: false,
        },
        lastContactAt: lastContact,
        lastContactChannel: "message",
      },
    });
  }

  // Generate 15 midwife patients
  const midwifeFirstNames = ["Rose", "Iris", "Lily", "Violet", "Daisy", "Jasmine", "Flora", "Celeste", "Aurora", "Dawn", "Hope", "Grace", "Faith", "Joy", "Bliss"];
  const midwifeLastNames = ["Adams", "Baker", "Campbell", "Dixon", "Edwards", "Foster", "Green", "Hall", "Ingram", "James", "Kelly", "Lewis", "Morgan", "Nelson", "Owen"];
  const midwifeRisks: { score: number; level: RiskLevel }[] = [
    { score: 20, level: RiskLevel.LOW },
    { score: 45, level: RiskLevel.MODERATE },
    { score: 62, level: RiskLevel.HIGH },
    { score: 15, level: RiskLevel.LOW },
    { score: 38, level: RiskLevel.MODERATE },
    { score: 72, level: RiskLevel.HIGH },
    { score: 8, level: RiskLevel.LOW },
    { score: 55, level: RiskLevel.HIGH },
    { score: 30, level: RiskLevel.MODERATE },
    { score: 82, level: RiskLevel.VERY_HIGH },
    { score: 25, level: RiskLevel.LOW },
    { score: 48, level: RiskLevel.MODERATE },
    { score: 67, level: RiskLevel.HIGH },
    { score: 12, level: RiskLevel.LOW },
    { score: 40, level: RiskLevel.MODERATE },
  ];

  for (let i = 0; i < 15; i++) {
    const risk = midwifeRisks[i];
    const ga = randomBetween(10, 38);
    const dob = new Date(Date.now() - randomBetween(24, 40) * 365.25 * 24 * 3600 * 1000);

    await prisma.patient.create({
      data: {
        providerId: midwife.id,
        firstName: midwifeFirstNames[i],
        lastName: midwifeLastNames[i],
        dateOfBirth: dob,
        gestationalAgeWeeks: ga,
        dueDate: weeksFromNow(40 - ga),
        status: PatientStatus.PREGNANT,
        insuranceType: ["Medicaid", "BCBS", "Aetna"][i % 3],
        riskScore: risk.score,
        riskLevel: risk.level,
        riskFactors: [],
        medicalHistory: { bmi: randomBetween(21, 34), preexistingConditions: [] },
        socialDeterminants: { housingInstability: false, foodInsecurity: false, transportationBarrier: false, socialIsolation: false, intimatePartnerViolence: false },
        lastContactAt: daysAgo(randomBetween(1, 14)),
        lastContactChannel: "message",
      },
    });
  }

  // Generate 5 admin (OB-GYN) patients — very high risk
  const adminPatients = [
    { firstName: "Rachel", lastName: "Torres", score: 88, level: RiskLevel.VERY_HIGH, ga: 30 },
    { firstName: "Maya", lastName: "Patel", score: 75, level: RiskLevel.HIGH, ga: 35 },
    { firstName: "Zoe", lastName: "Kim", score: 91, level: RiskLevel.VERY_HIGH, ga: 28 },
    { firstName: "Nadia", lastName: "Hassan", score: 82, level: RiskLevel.VERY_HIGH, ga: 32 },
    { firstName: "Claire", lastName: "Murphy", score: 70, level: RiskLevel.HIGH, ga: 26 },
  ];

  for (const p of adminPatients) {
    const dob = new Date(Date.now() - randomBetween(28, 44) * 365.25 * 24 * 3600 * 1000);
    await prisma.patient.create({
      data: {
        providerId: admin.id,
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: dob,
        gestationalAgeWeeks: p.ga,
        dueDate: weeksFromNow(40 - p.ga),
        status: PatientStatus.PREGNANT,
        insuranceType: "Blue Cross PPO",
        riskScore: p.score,
        riskLevel: p.level,
        riskFactors: [],
        medicalHistory: { bmi: randomBetween(28, 38), preexistingConditions: ["chronic_hypertension", "preeclampsia_history"] },
        socialDeterminants: { housingInstability: false, foodInsecurity: false, transportationBarrier: false, socialIsolation: false, intimatePartnerViolence: false },
        lastContactAt: daysAgo(randomBetween(1, 5)),
        lastContactChannel: "message",
      },
    });
  }

  console.log("Patients created.");

  // --- APPOINTMENTS (archetype patients) ---
  const apptDate = (dayOffset: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  await prisma.appointment.createMany({
    data: [
      // Sarah — high-risk, urgent follow-up today + upcoming
      { patientId: sarah.id, providerId: nurse.id, type: "urgent", scheduledAt: apptDate(0, 10), duration: 45, status: "scheduled", notes: "BP 142/92 — urgent follow-up" },
      { patientId: sarah.id, providerId: nurse.id, type: "routine_prenatal", scheduledAt: apptDate(7, 9), duration: 30, status: "scheduled" },
      { patientId: sarah.id, providerId: nurse.id, type: "follow_up", scheduledAt: apptDate(-14, 10), duration: 30, status: "completed" },
      // Maria — GDM management
      { patientId: maria.id, providerId: nurse.id, type: "routine_prenatal", scheduledAt: apptDate(3, 14), duration: 30, status: "scheduled", notes: "GDM check-in" },
      { patientId: maria.id, providerId: nurse.id, type: "routine_prenatal", scheduledAt: apptDate(-7, 14), duration: 30, status: "completed" },
      // Aisha — disengaged, missed appointments
      { patientId: aisha.id, providerId: nurse.id, type: "routine_prenatal", scheduledAt: apptDate(-7, 11), duration: 30, status: "no_show" },
      { patientId: aisha.id, providerId: nurse.id, type: "follow_up", scheduledAt: apptDate(-14, 11), duration: 30, status: "no_show" },
      { patientId: aisha.id, providerId: nurse.id, type: "urgent", scheduledAt: apptDate(1, 11), duration: 45, status: "scheduled", notes: "Missed 2 appointments — outreach attempt" },
      // Jennifer — low-risk, routine
      { patientId: jennifer.id, providerId: nurse.id, type: "routine_prenatal", scheduledAt: apptDate(0, 13), duration: 30, status: "scheduled" },
      { patientId: jennifer.id, providerId: nurse.id, type: "routine_prenatal", scheduledAt: apptDate(14, 13), duration: 30, status: "scheduled" },
      // Keiko — postpartum
      { patientId: keiko.id, providerId: nurse.id, type: "postpartum", scheduledAt: apptDate(2, 10), duration: 45, status: "scheduled", notes: "Postpartum check-in + PHQ-9" },
      { patientId: keiko.id, providerId: nurse.id, type: "postpartum", scheduledAt: apptDate(-10, 10), duration: 45, status: "completed" },
    ],
  });

  console.log("Appointments created.");

  // --- PORTAL USERS (patient-facing accounts) ---
  const portalHash = await hashPassword("patient123");

  await prisma.patientUser.createMany({
    data: [
      {
        patientId: sarah.id,
        email: "sarah@patient.dev",
        passwordHash: portalHash,
        consentedAt: daysAgo(60),
      },
      {
        patientId: maria.id,
        email: "maria@patient.dev",
        passwordHash: portalHash,
        consentedAt: daysAgo(56),
      },
      {
        patientId: aisha.id,
        email: "aisha@patient.dev",
        passwordHash: portalHash,
        consentedAt: daysAgo(50),
      },
      {
        patientId: jennifer.id,
        email: "jennifer@patient.dev",
        passwordHash: portalHash,
        consentedAt: daysAgo(30),
      },
      {
        patientId: keiko.id,
        email: "keiko@patient.dev",
        passwordHash: portalHash,
        consentedAt: daysAgo(21),
      },
    ],
  });

  console.log("Portal users created.");
  console.log("  sarah@patient.dev / patient123");
  console.log("  maria@patient.dev / patient123");
  console.log("  aisha@patient.dev / patient123");
  console.log("  jennifer@patient.dev / patient123");
  console.log("  keiko@patient.dev / patient123");

  const counts = await prisma.patient.count();
  console.log(`Total patients: ${counts}`);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
