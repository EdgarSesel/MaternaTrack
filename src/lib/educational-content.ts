/**
 * Gestational-age-appropriate educational content for the patient portal.
 * Content is keyed by gestational age range in weeks.
 */

export interface EducationalContent {
  week: string;
  milestone: string;
  babySize: string;
  whatToExpect: string[];
  nutritionTips: string[];
  warningSigns: string[];
  upcomingAppointment?: string;
}

const POSTPARTUM_CONTENT: EducationalContent = {
  week: "Postpartum",
  milestone: "Recovery & bonding",
  babySize: "Your newborn",
  whatToExpect: [
    "Postpartum bleeding (lochia) is normal for 4–6 weeks",
    "Baby will lose up to 10% of birth weight before regaining it",
    "Breastfeeding establishes milk supply in 3–5 days",
    "Mood changes are common — reach out if they persist beyond 2 weeks",
  ],
  nutritionTips: [
    "Continue prenatal vitamins while breastfeeding",
    "Stay well hydrated — breastfeeding requires 16 cups of fluid daily",
    "Prioritize iron-rich foods to recover from blood loss",
    "Eat frequent small meals to maintain energy",
  ],
  warningSigns: [
    "Fever above 100.4°F",
    "Heavy bleeding (soaking a pad per hour)",
    "Severe headache or visual changes",
    "Signs of postpartum depression: hopelessness, inability to care for baby",
    "Redness, warmth, or swelling in one leg (possible clot)",
  ],
  upcomingAppointment: "Postpartum visit at 6 weeks",
};

const CONTENT_BY_WEEK: Record<string, EducationalContent> = {
  "4-8": {
    week: "4–8 weeks",
    milestone: "Embryo forming — heart begins beating",
    babySize: "Poppy seed to raspberry",
    whatToExpect: [
      "Morning sickness may start around week 6",
      "Breast tenderness and fatigue are common",
      "First prenatal appointment: blood work, ultrasound, due date confirmation",
      "Avoid alcohol, tobacco, and unprescribed medications",
    ],
    nutritionTips: [
      "Take folic acid 400–800 mcg daily to prevent neural tube defects (ACOG)",
      "Eat small, frequent meals to ease nausea",
      "Stay hydrated — try cold water or ginger tea for nausea",
      "Avoid raw fish, deli meats, and unpasteurized cheeses",
    ],
    warningSigns: [
      "Heavy vaginal bleeding or severe cramping",
      "Fever above 100.4°F",
      "Severe vomiting — unable to keep any food down",
    ],
    upcomingAppointment: "First prenatal visit (8–10 weeks)",
  },
  "9-12": {
    week: "9–12 weeks",
    milestone: "All major organs forming",
    babySize: "Grape to plum",
    whatToExpect: [
      "Nausea often peaks around week 9–10",
      "First trimester screening (nuchal translucency, blood tests)",
      "Risk of miscarriage decreases significantly after week 10",
      "You may hear the heartbeat on Doppler",
    ],
    nutritionTips: [
      "Continue folic acid; add omega-3s (DHA 200mg/day for brain development)",
      "Aim for 1,000mg calcium daily",
      "Limit caffeine to under 200mg/day (one 12oz coffee)",
    ],
    warningSigns: [
      "Vaginal bleeding or clots",
      "Sudden relief of all pregnancy symptoms",
      "Severe abdominal pain on one side",
    ],
    upcomingAppointment: "First trimester screening (10–13 weeks)",
  },
  "13-16": {
    week: "13–16 weeks",
    milestone: "Second trimester begins — energy often returns",
    babySize: "Lemon to avocado",
    whatToExpect: [
      "Morning sickness usually improves",
      "Baby can now make facial expressions",
      "Your bump may start to show",
      "Second trimester is often the most comfortable",
    ],
    nutritionTips: [
      "Increase calorie intake by ~340 calories/day",
      "Iron-rich foods: lean meat, beans, spinach (prevents anemia)",
      "Pair iron with vitamin C for better absorption",
    ],
    warningSigns: [
      "Any vaginal bleeding",
      "Persistent severe headache",
      "Sudden swelling in hands or face",
    ],
    upcomingAppointment: "Anatomy ultrasound coming at 18–22 weeks",
  },
  "17-20": {
    week: "17–20 weeks",
    milestone: "Halfway there! Baby starts moving",
    babySize: "Sweet potato to banana",
    whatToExpect: [
      "You may feel baby's first movements (\"quickening\") around week 18–20",
      "Anatomy scan ultrasound checks all organs and may reveal sex",
      "Back pain may begin as your center of gravity shifts",
      "Stretch marks may appear",
    ],
    nutritionTips: [
      "Add 450 extra calories/day in second half of pregnancy",
      "Continue DHA for brain development",
      "Magnesium-rich foods (nuts, whole grains) can ease leg cramps",
    ],
    warningSigns: [
      "Absence of fetal movement after week 20",
      "Fluid leaking from vagina",
      "Persistent contractions before 37 weeks",
    ],
    upcomingAppointment: "Anatomy ultrasound (18–22 weeks)",
  },
  "21-24": {
    week: "21–24 weeks",
    milestone: "Viability milestone approaching at 24 weeks",
    babySize: "Ear of corn",
    whatToExpect: [
      "Baby is practicing breathing movements",
      "Glucose challenge test for gestational diabetes (24–28 weeks)",
      "Braxton Hicks contractions may begin (normal)",
      "Heartburn and indigestion are common as uterus grows",
    ],
    nutritionTips: [
      "Eat small meals more frequently to ease heartburn",
      "Avoid lying down immediately after eating",
      "1,000mg calcium daily supports baby's bone development",
    ],
    warningSigns: [
      "More than 6 contractions per hour",
      "Pressure in pelvis or lower back",
      "Fluid leaking",
      "Signs of preeclampsia: severe headache, vision changes, sudden swelling",
    ],
    upcomingAppointment: "Glucose challenge test (24–28 weeks)",
  },
  "25-28": {
    week: "25–28 weeks",
    milestone: "Third trimester approaching — baby gaining weight",
    babySize: "Butternut squash",
    whatToExpect: [
      "Glucose tolerance test to rule out gestational diabetes",
      "Tdap vaccine recommended (27–36 weeks) to protect newborn from whooping cough",
      "Baby's eyes are opening and closing",
      "Sleep may become more difficult — try sleeping on your left side",
    ],
    nutritionTips: [
      "Continue iron supplementation if prescribed",
      "Protein goal: 70–100g/day for fetal growth",
      "Dates (the fruit) in late pregnancy may support cervical ripening",
    ],
    warningSigns: [
      "Blood pressure above 140/90",
      "Severe upper abdominal pain (possible preeclampsia)",
      "Decreased fetal movement — do kick counts",
      "Signs of preterm labor: regular contractions, back pain, pelvic pressure",
    ],
    upcomingAppointment: "Tdap vaccine, RhoGAM if Rh-negative",
  },
  "29-32": {
    week: "29–32 weeks",
    milestone: "Baby's brain is developing rapidly",
    babySize: "Pineapple",
    whatToExpect: [
      "Appointments become more frequent (every 2 weeks)",
      "Do daily kick counts: 10 movements in 2 hours (ACOG)",
      "Baby may be in breech position — still time to turn",
      "Shortness of breath as uterus pushes up on diaphragm",
    ],
    nutritionTips: [
      "Omega-3 (DHA) supports brain development surge",
      "Continue prenatal vitamin with iron",
      "Constipation is common — increase fiber and water",
    ],
    warningSigns: [
      "Fever, chills, painful urination (UTI)",
      "Less than 10 kicks in 2 hours",
      "Regular contractions before 37 weeks (preterm labor)",
      "Sudden severe headache, vision changes",
    ],
    upcomingAppointment: "Appointments every 2 weeks now",
  },
  "33-36": {
    week: "33–36 weeks",
    milestone: "Baby is gaining a half pound per week",
    babySize: "Honeydew melon",
    whatToExpect: [
      "Group B Strep test around 35–37 weeks (vaginal/rectal swab)",
      "Baby settling into head-down position",
      "Pelvic pressure as baby drops (\"lightening\")",
      "Weekly appointments begin at 36 weeks",
    ],
    nutritionTips: [
      "Continue eating well — baby stores nutrients in final weeks",
      "Stay hydrated to support amniotic fluid levels",
      "Light, frequent meals help with less stomach room",
    ],
    warningSigns: [
      "Regular contractions more than 6/hour before 37 weeks",
      "Rupture of membranes (gush or slow leak of fluid)",
      "Severe headache, visual changes, severe swelling",
      "Reduced fetal movement",
    ],
    upcomingAppointment: "Group B Strep test (35–37 weeks), weekly visits",
  },
  "37-40": {
    week: "37–40 weeks",
    milestone: "Full term! Ready for arrival",
    babySize: "Watermelon",
    whatToExpect: [
      "Term is 39–40 weeks; 37–38 weeks is early term",
      "Cervical checks may begin to assess readiness for labor",
      "Nesting instinct is common — rest when you can",
      "Know the signs of labor: regular contractions, water breaking, bloody show",
    ],
    nutritionTips: [
      "Stay well hydrated for labor",
      "Light, easy-to-digest foods in late pregnancy",
      "Pack snacks for the hospital bag",
    ],
    warningSigns: [
      "Signs of labor: water breaking, regular contractions every 5 min for 1 hour",
      "Severe headache, vision changes, upper abdominal pain (preeclampsia — go now)",
      "No fetal movement",
      "Bleeding more than a period",
    ],
    upcomingAppointment: "Weekly visits, birth plan review",
  },
};

function getGaRange(weeks: number): string {
  if (weeks <= 8) return "4-8";
  if (weeks <= 12) return "9-12";
  if (weeks <= 16) return "13-16";
  if (weeks <= 20) return "17-20";
  if (weeks <= 24) return "21-24";
  if (weeks <= 28) return "25-28";
  if (weeks <= 32) return "29-32";
  if (weeks <= 36) return "33-36";
  return "37-40";
}

export function getEducationalContent(
  gestationalAgeWeeks: number | null | undefined,
  status: string,
): EducationalContent | null {
  if (status === "POSTPARTUM") return POSTPARTUM_CONTENT;
  if (!gestationalAgeWeeks) return null;
  const range = getGaRange(gestationalAgeWeeks);
  return CONTENT_BY_WEEK[range] ?? null;
}
