// Screening tool definitions — question sets, scoring, and interpretations
// Supports: PHQ-9, EPDS, GAD-7, GDM Screen, SDOH Checklist

export type AnswerOption = {
  label: string;
  value: number;
};

export type Question = {
  id: string;
  text: string;
  options: AnswerOption[];
  reverse?: boolean; // for items that score inversely
};

export type ScoreCutoff = {
  min: number;
  max: number;
  label: string;
  riskResult: "low" | "moderate" | "high" | "positive" | "negative";
  description: string;
  action: string;
};

export type ScreeningDefinition = {
  type: string;
  name: string;
  description: string;
  totalItems: number;
  minScore: number;
  maxScore: number;
  questions: Question[];
  cutoffs: ScoreCutoff[];
  instructions: string;
  scoringNote?: string;
};

// ---------------------------------------------------------------------------
// PHQ-9 — Patient Health Questionnaire (Depression)
// ---------------------------------------------------------------------------
const PHQ9_OPTIONS: AnswerOption[] = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

export const PHQ9: ScreeningDefinition = {
  type: "phq9",
  name: "PHQ-9",
  description: "Patient Health Questionnaire — Depression Screen",
  totalItems: 9,
  minScore: 0,
  maxScore: 27,
  instructions:
    "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
  scoringNote:
    "If question 9 score ≥ 1, assess for suicidal ideation. Total score interpretation applies only after ruling out physical causes.",
  questions: [
    {
      id: "phq9_1",
      text: "Little interest or pleasure in doing things",
      options: PHQ9_OPTIONS,
    },
    {
      id: "phq9_2",
      text: "Feeling down, depressed, or hopeless",
      options: PHQ9_OPTIONS,
    },
    {
      id: "phq9_3",
      text: "Trouble falling or staying asleep, or sleeping too much",
      options: PHQ9_OPTIONS,
    },
    {
      id: "phq9_4",
      text: "Feeling tired or having little energy",
      options: PHQ9_OPTIONS,
    },
    {
      id: "phq9_5",
      text: "Poor appetite or overeating",
      options: PHQ9_OPTIONS,
    },
    {
      id: "phq9_6",
      text: "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
      options: PHQ9_OPTIONS,
    },
    {
      id: "phq9_7",
      text: "Trouble concentrating on things, such as reading the newspaper or watching television",
      options: PHQ9_OPTIONS,
    },
    {
      id: "phq9_8",
      text: "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
      options: PHQ9_OPTIONS,
    },
    {
      id: "phq9_9",
      text: "Thoughts that you would be better off dead, or thoughts of hurting yourself in some way",
      options: PHQ9_OPTIONS,
    },
  ],
  cutoffs: [
    {
      min: 0,
      max: 4,
      label: "None–minimal",
      riskResult: "low",
      description: "Minimal or no depressive symptoms.",
      action: "Rescreen at next scheduled visit per protocol.",
    },
    {
      min: 5,
      max: 9,
      label: "Mild",
      riskResult: "low",
      description: "Mild depressive symptoms.",
      action: "Watchful waiting; rescreen in 2–4 weeks.",
    },
    {
      min: 10,
      max: 14,
      label: "Moderate",
      riskResult: "moderate",
      description: "Moderate depressive symptoms.",
      action: "Discuss treatment options with prescribing provider; consider counseling referral.",
    },
    {
      min: 15,
      max: 19,
      label: "Moderately severe",
      riskResult: "high",
      description: "Moderately severe depression.",
      action: "Active treatment recommended — pharmacotherapy and/or psychotherapy.",
    },
    {
      min: 20,
      max: 27,
      label: "Severe",
      riskResult: "high",
      description: "Severe depression.",
      action: "Immediate treatment; consider urgent psychiatric referral.",
    },
  ],
};

// ---------------------------------------------------------------------------
// EPDS — Edinburgh Postnatal Depression Scale
// ---------------------------------------------------------------------------
export const EPDS: ScreeningDefinition = {
  type: "epds",
  name: "EPDS",
  description: "Edinburgh Postnatal Depression Scale",
  totalItems: 10,
  minScore: 0,
  maxScore: 30,
  instructions:
    "Please select the answer that comes closest to how you have felt in the past 7 days — not just how you feel today.",
  scoringNote:
    "Question 10 (self-harm) is scored separately. Any score ≥ 1 on Q10 requires immediate safety assessment regardless of total score.",
  questions: [
    {
      id: "epds_1",
      text: "I have been able to laugh and see the funny side of things",
      options: [
        { label: "As much as I always could", value: 0 },
        { label: "Not quite so much now", value: 1 },
        { label: "Definitely not so much now", value: 2 },
        { label: "Not at all", value: 3 },
      ],
    },
    {
      id: "epds_2",
      text: "I have looked forward with enjoyment to things",
      options: [
        { label: "As much as I ever did", value: 0 },
        { label: "Rather less than I used to", value: 1 },
        { label: "Definitely less than I used to", value: 2 },
        { label: "Hardly at all", value: 3 },
      ],
    },
    {
      id: "epds_3",
      text: "I have blamed myself unnecessarily when things went wrong",
      options: [
        { label: "No, never", value: 0 },
        { label: "Not very often", value: 1 },
        { label: "Yes, some of the time", value: 2 },
        { label: "Yes, most of the time", value: 3 },
      ],
      reverse: true,
    },
    {
      id: "epds_4",
      text: "I have been anxious or worried for no good reason",
      options: [
        { label: "No, not at all", value: 0 },
        { label: "Hardly ever", value: 1 },
        { label: "Yes, sometimes", value: 2 },
        { label: "Yes, very often", value: 3 },
      ],
      reverse: true,
    },
    {
      id: "epds_5",
      text: "I have felt scared or panicky for no very good reason",
      options: [
        { label: "No, not at all", value: 0 },
        { label: "No, not much", value: 1 },
        { label: "Yes, sometimes", value: 2 },
        { label: "Yes, quite a lot", value: 3 },
      ],
      reverse: true,
    },
    {
      id: "epds_6",
      text: "Things have been getting on top of me",
      options: [
        { label: "No, I have been coping as well as ever", value: 0 },
        { label: "No, most of the time I have coped quite well", value: 1 },
        { label: "Yes, sometimes I haven't been coping as well as usual", value: 2 },
        { label: "Yes, most of the time I haven't been able to cope at all", value: 3 },
      ],
      reverse: true,
    },
    {
      id: "epds_7",
      text: "I have been so unhappy that I have had difficulty sleeping",
      options: [
        { label: "No, not at all", value: 0 },
        { label: "Not very often", value: 1 },
        { label: "Yes, sometimes", value: 2 },
        { label: "Yes, most of the time", value: 3 },
      ],
      reverse: true,
    },
    {
      id: "epds_8",
      text: "I have felt sad or miserable",
      options: [
        { label: "No, not at all", value: 0 },
        { label: "Not very often", value: 1 },
        { label: "Yes, quite often", value: 2 },
        { label: "Yes, most of the time", value: 3 },
      ],
      reverse: true,
    },
    {
      id: "epds_9",
      text: "I have been so unhappy that I have been crying",
      options: [
        { label: "No, never", value: 0 },
        { label: "Only occasionally", value: 1 },
        { label: "Yes, quite often", value: 2 },
        { label: "Yes, most of the time", value: 3 },
      ],
      reverse: true,
    },
    {
      id: "epds_10",
      text: "The thought of harming myself has occurred to me",
      options: [
        { label: "Never", value: 0 },
        { label: "Hardly ever", value: 1 },
        { label: "Sometimes", value: 2 },
        { label: "Yes, quite often", value: 3 },
      ],
      reverse: true,
    },
  ],
  cutoffs: [
    {
      min: 0,
      max: 9,
      label: "Low risk",
      riskResult: "low",
      description: "Low probability of depression.",
      action: "Rescreen postpartum as per protocol (2 weeks, 6 weeks, 6 months).",
    },
    {
      min: 10,
      max: 12,
      label: "Possible depression",
      riskResult: "moderate",
      description: "Possible depression — borderline score.",
      action: "Repeat EPDS in 2 weeks; consider referral to behavioral health.",
    },
    {
      min: 13,
      max: 30,
      label: "Probable depression",
      riskResult: "high",
      description: "Probable depression — clinical evaluation required.",
      action: "Refer to mental health provider; assess safety and support system.",
    },
  ],
};

// ---------------------------------------------------------------------------
// GAD-7 — Generalized Anxiety Disorder Scale
// ---------------------------------------------------------------------------
const GAD7_OPTIONS: AnswerOption[] = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

export const GAD7: ScreeningDefinition = {
  type: "gad7",
  name: "GAD-7",
  description: "Generalized Anxiety Disorder Scale",
  totalItems: 7,
  minScore: 0,
  maxScore: 21,
  instructions:
    "Over the last 2 weeks, how often have you been bothered by the following problems?",
  questions: [
    { id: "gad7_1", text: "Feeling nervous, anxious, or on edge", options: GAD7_OPTIONS },
    { id: "gad7_2", text: "Not being able to stop or control worrying", options: GAD7_OPTIONS },
    { id: "gad7_3", text: "Worrying too much about different things", options: GAD7_OPTIONS },
    { id: "gad7_4", text: "Trouble relaxing", options: GAD7_OPTIONS },
    {
      id: "gad7_5",
      text: "Being so restless that it is hard to sit still",
      options: GAD7_OPTIONS,
    },
    { id: "gad7_6", text: "Becoming easily annoyed or irritable", options: GAD7_OPTIONS },
    {
      id: "gad7_7",
      text: "Feeling afraid, as if something awful might happen",
      options: GAD7_OPTIONS,
    },
  ],
  cutoffs: [
    {
      min: 0,
      max: 4,
      label: "Minimal anxiety",
      riskResult: "low",
      description: "Minimal anxiety symptoms.",
      action: "Routine monitoring.",
    },
    {
      min: 5,
      max: 9,
      label: "Mild anxiety",
      riskResult: "low",
      description: "Mild anxiety.",
      action: "Watchful waiting; provide self-care resources.",
    },
    {
      min: 10,
      max: 14,
      label: "Moderate anxiety",
      riskResult: "moderate",
      description: "Moderate anxiety.",
      action: "Consider counseling or pharmacotherapy; rescreen in 4 weeks.",
    },
    {
      min: 15,
      max: 21,
      label: "Severe anxiety",
      riskResult: "high",
      description: "Severe anxiety.",
      action: "Refer to mental health provider; discuss treatment urgently.",
    },
  ],
};

// ---------------------------------------------------------------------------
// GDM Screen — Gestational Diabetes Risk Assessment
// (Not a scored questionnaire — categorical risk factors)
// ---------------------------------------------------------------------------
type GdmQuestion = {
  id: string;
  text: string;
  category: string;
  weight: "high" | "moderate" | "low";
  options: AnswerOption[];
};

export type GdmScreenDefinition = {
  type: "gdm_screen";
  name: string;
  description: string;
  instructions: string;
  questions: GdmQuestion[];
  scoringNote: string;
};

export const GDM_SCREEN: GdmScreenDefinition = {
  type: "gdm_screen",
  name: "GDM Risk Screen",
  description: "Gestational Diabetes Mellitus Risk Assessment",
  instructions:
    "Assess the following risk factors for gestational diabetes mellitus (GDM). This screen guides the decision to order early glucose testing (before 24 weeks).",
  scoringNote:
    "Any HIGH-weight factor alone warrants early GDM testing. Two or more MODERATE factors also warrant early testing. Results per ACOG Practice Bulletin #190.",
  questions: [
    {
      id: "gdm_1",
      text: "Previous GDM in a prior pregnancy",
      category: "History",
      weight: "high",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "gdm_2",
      text: "Pre-pregnancy BMI ≥ 30",
      category: "Anthropometric",
      weight: "high",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "gdm_3",
      text: "First-degree family member with type 2 diabetes",
      category: "Family History",
      weight: "moderate",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "gdm_4",
      text: "Member of high-risk ethnic group (Hispanic, Black, Native American, South or East Asian, Pacific Islander)",
      category: "Ethnicity",
      weight: "moderate",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "gdm_5",
      text: "Polycystic ovary syndrome (PCOS)",
      category: "Medical History",
      weight: "moderate",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "gdm_6",
      text: "Previous macrosomic baby (≥ 4000g or ≥ 8 lb 13 oz)",
      category: "Obstetric History",
      weight: "moderate",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "gdm_7",
      text: "Pre-diabetes (impaired fasting glucose or impaired glucose tolerance) prior to pregnancy",
      category: "Medical History",
      weight: "high",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "gdm_8",
      text: "Glycosuria on routine urinalysis this pregnancy",
      category: "Clinical Finding",
      weight: "moderate",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// SDOH — Social Determinants of Health Checklist
// ---------------------------------------------------------------------------
export const SDOH_SCREEN: ScreeningDefinition = {
  type: "sdoh",
  name: "SDOH Checklist",
  description: "Social Determinants of Health — Pregnancy Screening",
  totalItems: 10,
  minScore: 0,
  maxScore: 10,
  instructions:
    "The following questions ask about circumstances in your life that can affect health. Please check all that apply.",
  scoringNote:
    "Each 'Yes' identifies an unmet social need. Document specific needs and connect to community resources. Refer to social work for 3+ unmet needs.",
  questions: [
    {
      id: "sdoh_1",
      text: "Housing instability — Are you worried about losing your housing, or do you live in unstable housing?",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "sdoh_2",
      text: "Food insecurity — In the past 12 months, were you worried whether food would run out before you got money to buy more?",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "sdoh_3",
      text: "Transportation barrier — Has a lack of transportation kept you from medical appointments or getting medications?",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "sdoh_4",
      text: "Social isolation — Do you feel isolated from others?",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "sdoh_5",
      text: "Intimate partner violence — Do you feel safe in your current relationship? (Answer 'Yes' to flag concern)",
      options: [
        { label: "I feel safe", value: 0 },
        { label: "I do not feel safe / I have safety concerns", value: 1 },
      ],
    },
    {
      id: "sdoh_6",
      text: "Utility needs — Have you been unable to pay utility bills (gas, electricity, water) in the past 12 months?",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "sdoh_7",
      text: "Employment / financial stress — Are financial worries a significant source of stress for you?",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "sdoh_8",
      text: "Immigration concerns — Do you have concerns related to immigration that affect your access to care?",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "sdoh_9",
      text: "Childcare / dependent care stress — Do you have difficulty accessing childcare or caring for dependents?",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      id: "sdoh_10",
      text: "Substance use — Are you currently using alcohol, tobacco, or other substances?",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
  ],
  cutoffs: [
    {
      min: 0,
      max: 0,
      label: "No unmet needs",
      riskResult: "low",
      description: "No social needs identified at this time.",
      action: "Rescreen each trimester and postpartum.",
    },
    {
      min: 1,
      max: 2,
      label: "1–2 unmet needs",
      riskResult: "moderate",
      description: "One or two social needs identified.",
      action: "Provide community resource list; document in care plan.",
    },
    {
      min: 3,
      max: 10,
      label: "3+ unmet needs",
      riskResult: "high",
      description: "Multiple social needs — high complexity.",
      action: "Refer to social work; connect to WIC, housing assistance, and other programs as appropriate.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
export const SCREENING_DEFINITIONS: Record<
  string,
  ScreeningDefinition | GdmScreenDefinition
> = {
  phq9: PHQ9,
  epds: EPDS,
  gad7: GAD7,
  gdm_screen: GDM_SCREEN,
  sdoh: SDOH_SCREEN,
};

export const SCREENING_TYPE_LABELS: Record<string, string> = {
  phq9: "PHQ-9 (Depression)",
  epds: "EPDS (Perinatal Depression)",
  gad7: "GAD-7 (Anxiety)",
  gdm_screen: "GDM Risk Screen",
  sdoh: "SDOH Checklist",
};

// Compute score and result for scored tools (PHQ-9, EPDS, GAD-7, SDOH)
export function computeScreeningResult(
  definition: ScreeningDefinition,
  responses: Record<string, number>
): { score: number; riskResult: string; label: string; description: string; action: string } {
  const score = definition.questions.reduce((sum, q) => {
    return sum + (responses[q.id] ?? 0);
  }, 0);

  const cutoff = definition.cutoffs.find((c) => score >= c.min && score <= c.max);

  return {
    score,
    riskResult: cutoff?.riskResult ?? "low",
    label: cutoff?.label ?? "Unknown",
    description: cutoff?.description ?? "",
    action: cutoff?.action ?? "",
  };
}

// Compute GDM result from categorical responses
export function computeGdmResult(responses: Record<string, number>): {
  riskResult: "positive" | "negative";
  label: string;
  description: string;
  action: string;
  flaggedFactors: string[];
} {
  const highWeightFlags = GDM_SCREEN.questions
    .filter((q) => q.weight === "high" && responses[q.id] === 1)
    .map((q) => q.text);

  const moderateFlags = GDM_SCREEN.questions
    .filter((q) => q.weight === "moderate" && responses[q.id] === 1)
    .map((q) => q.text);

  const isPositive = highWeightFlags.length > 0 || moderateFlags.length >= 2;

  return {
    riskResult: isPositive ? "positive" : "negative",
    label: isPositive ? "Elevated GDM Risk" : "Standard Risk",
    description: isPositive
      ? `${highWeightFlags.length} high-weight and ${moderateFlags.length} moderate-weight risk factors identified.`
      : "No significant GDM risk factors identified at this time.",
    action: isPositive
      ? "Order early glucose challenge test (GCT) before 24 weeks per ACOG PB #190. Counsel on diet and activity."
      : "Proceed with standard 24–28 week GCT screening per routine prenatal protocol.",
    flaggedFactors: [...highWeightFlags, ...moderateFlags],
  };
}
