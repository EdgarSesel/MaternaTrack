/**
 * Care Protocol Templates
 *
 * Each protocol defines a set of tasks to generate when activated.
 * daysFromNow is relative to activation date.
 */

export const PROTOCOL_TYPES = [
  "standard_prenatal",
  "preeclampsia_prevention",
  "gdm_management",
  "perinatal_depression",
] as const;

export type ProtocolType = (typeof PROTOCOL_TYPES)[number];

export const PROTOCOL_LABELS: Record<ProtocolType, string> = {
  standard_prenatal: "Standard Prenatal Protocol",
  preeclampsia_prevention: "Preeclampsia Prevention",
  gdm_management: "GDM Management",
  perinatal_depression: "Perinatal Mental Health",
};

export const PROTOCOL_DESCRIPTIONS: Record<ProtocolType, string> = {
  standard_prenatal:
    "Routine prenatal monitoring including labs, vitals, and scheduled screenings.",
  preeclampsia_prevention:
    "Enhanced BP monitoring and early intervention protocol per ACOG guidelines.",
  gdm_management:
    "Structured glucose monitoring, dietary guidance, and medication review.",
  perinatal_depression:
    "Regular PHQ-9 / EPDS screenings and mental health support per USPSTF guidelines.",
};

interface TaskTemplate {
  title: string;
  description: string;
  daysFromNow: number;
  priority: "urgent" | "high" | "normal" | "low";
}

export const PROTOCOL_TASKS: Record<ProtocolType, TaskTemplate[]> = {
  standard_prenatal: [
    {
      title: "Complete initial intake labs",
      description:
        "Order CBC, blood type & antibody screen, RPR, rubella titer, HBsAg, HIV, urine culture.",
      daysFromNow: 3,
      priority: "high",
    },
    {
      title: "Obtain baseline blood pressure and weight",
      description: "Document BP and weight at intake as baseline for future comparisons.",
      daysFromNow: 3,
      priority: "high",
    },
    {
      title: "Schedule anatomy ultrasound (18–20 weeks)",
      description: "Standard fetal anatomy survey per ACOG guidelines.",
      daysFromNow: 14,
      priority: "normal",
    },
    {
      title: "GDM screening at 24–28 weeks",
      description: "1-hour 50g glucose challenge test. If ≥140 mg/dL, proceed to 3-hour GTT.",
      daysFromNow: 21,
      priority: "normal",
    },
    {
      title: "Group B Strep (GBS) culture at 35–37 weeks",
      description: "Rectovaginal swab per ACOG guidelines.",
      daysFromNow: 28,
      priority: "normal",
    },
    {
      title: "Administer TDAP vaccine",
      description:
        "Recommended between 27–36 weeks of pregnancy to protect newborn from pertussis.",
      daysFromNow: 21,
      priority: "normal",
    },
    {
      title: "Postpartum follow-up appointment",
      description:
        "Comprehensive postpartum visit within 12 weeks of delivery per ACOG.",
      daysFromNow: 90,
      priority: "normal",
    },
  ],

  preeclampsia_prevention: [
    {
      title: "Initiate low-dose aspirin (81 mg daily)",
      description:
        "USPSTF recommends aspirin prophylaxis for high-risk patients starting at 12–28 weeks. Confirm no contraindications.",
      daysFromNow: 1,
      priority: "urgent",
    },
    {
      title: "Blood pressure check — 2-week follow-up",
      description:
        "Monitor BP closely. Flag if systolic ≥130 or diastolic ≥80 for enhanced monitoring.",
      daysFromNow: 14,
      priority: "high",
    },
    {
      title: "Urine protein/creatinine ratio",
      description: "Spot urine to screen for proteinuria. Ratio >0.3 is clinically significant.",
      daysFromNow: 7,
      priority: "high",
    },
    {
      title: "Growth ultrasound at 28 weeks",
      description: "Assess fetal growth and amniotic fluid index (AFI) for FGR screening.",
      daysFromNow: 21,
      priority: "normal",
    },
    {
      title: "MFM (Maternal-Fetal Medicine) referral",
      description:
        "Refer to MFM specialist for co-management per SMFM high-risk guidelines.",
      daysFromNow: 7,
      priority: "high",
    },
    {
      title: "Biophysical profile (BPP) if indicated",
      description:
        "Schedule BPP if abnormal NST or clinical concern for placental insufficiency.",
      daysFromNow: 28,
      priority: "normal",
    },
    {
      title: "Review warning signs with patient",
      description:
        "Educate on preeclampsia warning signs: severe headache, visual changes, RUQ pain, sudden swelling. Document counseling.",
      daysFromNow: 3,
      priority: "high",
    },
  ],

  gdm_management: [
    {
      title: "Glucose monitoring instruction",
      description:
        "Teach patient to check fasting and 1-hour post-meal glucose. Target: fasting <95, 1-hr post-meal <140 mg/dL.",
      daysFromNow: 2,
      priority: "urgent",
    },
    {
      title: "Dietitian referral for medical nutrition therapy",
      description:
        "Refer to registered dietitian for individualized GDM meal plan per ADA and ACOG guidelines.",
      daysFromNow: 3,
      priority: "high",
    },
    {
      title: "Fasting glucose review — 2-week follow-up",
      description:
        "Review glucose log. If fasting consistently >95 mg/dL despite diet, discuss medication initiation.",
      daysFromNow: 14,
      priority: "high",
    },
    {
      title: "HbA1c review",
      description: "Order HbA1c to assess glycemic control over the past 2–3 months.",
      daysFromNow: 14,
      priority: "normal",
    },
    {
      title: "Review medication if glucose targets not met",
      description:
        "Consider metformin or insulin if dietary modification fails to meet targets after 1–2 weeks.",
      daysFromNow: 21,
      priority: "normal",
    },
    {
      title: "Growth ultrasound (macrosomia screening)",
      description:
        "Serial ultrasounds every 4 weeks from 28 weeks to monitor for macrosomia (EFW >90th percentile).",
      daysFromNow: 21,
      priority: "normal",
    },
    {
      title: "Postpartum glucose screening",
      description:
        "75g OGTT at 4–12 weeks postpartum to screen for persistent diabetes or prediabetes.",
      daysFromNow: 84,
      priority: "normal",
    },
  ],

  perinatal_depression: [
    {
      title: "PHQ-9 depression screening — initial",
      description:
        "Administer PHQ-9 at intake. Score ≥10 warrants further evaluation; ≥15 requires immediate action.",
      daysFromNow: 2,
      priority: "high",
    },
    {
      title: "Mental health referral (if PHQ-9 ≥10)",
      description:
        "Refer to behavioral health specialist or perinatal psychiatry per USPSTF B recommendation.",
      daysFromNow: 5,
      priority: "high",
    },
    {
      title: "Safety screening (if PHQ-9 ≥15)",
      description:
        "Complete safety plan, assess SI/HI. Contact behavioral health same-day if score ≥20.",
      daysFromNow: 2,
      priority: "urgent",
    },
    {
      title: "PHQ-9 follow-up screening — 4 weeks",
      description: "Repeat PHQ-9 to monitor response to interventions or treatment.",
      daysFromNow: 28,
      priority: "normal",
    },
    {
      title: "Provide support resources",
      description:
        "Share Postpartum Support International (PSI) hotline, peer support groups, and crisis line.",
      daysFromNow: 3,
      priority: "normal",
    },
    {
      title: "EPDS postpartum screening at 6 weeks",
      description:
        "Edinburgh Postnatal Depression Scale (EPDS) at 6-week postpartum visit per ACOG.",
      daysFromNow: 42,
      priority: "high",
    },
    {
      title: "Weekly check-in call",
      description:
        "Brief weekly check-in call to assess mood, sleep, support system, and medication adherence.",
      daysFromNow: 7,
      priority: "normal",
    },
  ],
};

/**
 * Generate task create-data objects from a protocol template.
 * All dates are relative to `activatedAt`.
 */
export function generateProtocolTasks(
  protocolType: ProtocolType,
  patientId: string,
  carePlanId: string,
  activatedAt: Date = new Date(),
): {
  patientId: string;
  carePlanId: string;
  title: string;
  description: string;
  dueDate: Date;
  priority: string;
  status: "PENDING";
}[] {
  const templates = PROTOCOL_TASKS[protocolType] ?? [];
  return templates.map((t) => {
    const dueDate = new Date(activatedAt);
    dueDate.setDate(dueDate.getDate() + t.daysFromNow);
    return {
      patientId,
      carePlanId,
      title: t.title,
      description: t.description,
      dueDate,
      priority: t.priority,
      status: "PENDING" as const,
    };
  });
}
