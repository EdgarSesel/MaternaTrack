/**
 * Clinical compliance rule engine.
 * Checks patient adherence to ACOG / USPSTF / SMFM guidelines.
 *
 * Each rule returns { compliant: boolean, detail: string }.
 * Rules operate on the data already in the DB — no external calls.
 */

import { differenceInWeeks } from "date-fns";

export interface ComplianceRule {
  id: string;
  guideline: "ACOG" | "USPSTF" | "SMFM";
  title: string;
  description: string;
}

export const COMPLIANCE_RULES: ComplianceRule[] = [
  {
    id: "first_prenatal_visit",
    guideline: "ACOG",
    title: "First Prenatal Visit by 10 Weeks",
    description: "ACOG recommends first prenatal visit at or before 10 weeks GA.",
  },
  {
    id: "gdm_screen",
    guideline: "ACOG",
    title: "GDM Screening 24–28 Weeks",
    description: "ACOG recommends GDM screening between 24 and 28 weeks GA.",
  },
  {
    id: "depression_screen_trimester",
    guideline: "USPSTF",
    title: "Depression Screening Each Trimester",
    description: "USPSTF recommends PHQ-9 or EPDS screening at least once per trimester.",
  },
  {
    id: "postpartum_depression_screen",
    guideline: "USPSTF",
    title: "Postpartum Depression Screening",
    description: "USPSTF recommends depression screening at the postpartum visit (4–6 weeks).",
  },
  {
    id: "preeclampsia_risk_assessment",
    guideline: "SMFM",
    title: "Preeclampsia Risk Assessment at First Visit",
    description: "SMFM recommends preeclampsia risk factor assessment at the initial prenatal visit.",
  },
  {
    id: "aspirin_high_risk",
    guideline: "SMFM",
    title: "Low-Dose Aspirin by 16 Weeks (High-Risk)",
    description: "SMFM/USPSTF: Patients with ≥1 high-risk factor should start aspirin 81mg by 16 weeks.",
  },
];

export type ComplianceRuleId = typeof COMPLIANCE_RULES[number]["id"];

export interface PatientComplianceResult {
  patientId: string;
  patientName: string;
  ruleId: ComplianceRuleId;
  compliant: boolean;
  detail: string;
  status: "PREGNANT" | "POSTPARTUM" | "PRECONCEPTION" | "INACTIVE";
}

interface PatientForCompliance {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  gestationalAgeWeeks: number | null;
  enrollmentDate: Date;
  riskFactors: unknown;
  screenings: { type: string; administeredAt: Date }[];
  carePlans: { protocolType: string; activatedAt: Date }[];
}

function getRiskFactors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is string => typeof r === "string");
}

/**
 * Evaluate a single patient against all applicable compliance rules.
 */
export function evaluatePatientCompliance(
  patient: PatientForCompliance
): PatientComplianceResult[] {
  const results: PatientComplianceResult[] = [];
  const patientName = `${patient.firstName} ${patient.lastName}`;
  const ga = patient.gestationalAgeWeeks ?? 0;
  const riskFactors = getRiskFactors(patient.riskFactors);
  const isPregnant = patient.status === "PREGNANT";
  const isPostpartum = patient.status === "POSTPARTUM";

  for (const rule of COMPLIANCE_RULES) {
    let compliant = true;
    let detail = "Compliant";

    switch (rule.id) {
      case "first_prenatal_visit": {
        if (!isPregnant && !isPostpartum) break;
        // Check: enrollment date vs estimated conception (approx: current GA + weeks since enrollment)
        // Simplified: if enrolled before 10 weeks → compliant; else not
        const enrolledGa =
          ga - differenceInWeeks(new Date(), new Date(patient.enrollmentDate));
        if (enrolledGa > 10) {
          compliant = false;
          detail = `Enrolled at estimated ${enrolledGa}w GA (target: ≤10w)`;
        } else {
          detail = `Enrolled at estimated ${Math.max(enrolledGa, 0)}w GA`;
        }
        break;
      }

      case "gdm_screen": {
        if (!isPregnant && !isPostpartum) break;
        const gdmScreen = patient.screenings.find((s) => s.type === "gdm_screen");
        if (!gdmScreen) {
          if (ga >= 24) {
            compliant = false;
            detail = `GDM screen not documented (patient is ${ga}w GA)`;
          } else {
            detail = `Not yet due (patient is ${ga}w GA, screen due at 24–28w)`;
          }
        } else {
          detail = "GDM screen completed";
        }
        break;
      }

      case "depression_screen_trimester": {
        if (!isPregnant) break;
        const depressionTypes = ["phq9", "epds", "gad7"];
        const screens = patient.screenings.filter((s) =>
          depressionTypes.includes(s.type)
        );
        const trimestersDue = Math.min(Math.ceil(ga / 13), 3);
        if (trimestersDue === 0) break;
        const uniqueMonths = new Set(
          screens.map((s) => {
            const d = new Date(s.administeredAt);
            return `${d.getFullYear()}-${Math.floor(d.getMonth() / 3)}`;
          })
        );
        if (uniqueMonths.size < trimestersDue) {
          compliant = false;
          detail = `${uniqueMonths.size} of ${trimestersDue} trimester screens completed`;
        } else {
          detail = `${screens.length} depression screen(s) completed`;
        }
        break;
      }

      case "postpartum_depression_screen": {
        if (!isPostpartum) break;
        const postpartumScreen = patient.screenings.find(
          (s) => s.type === "phq9" || s.type === "epds"
        );
        if (!postpartumScreen) {
          compliant = false;
          detail = "No postpartum depression screening documented";
        } else {
          detail = "Postpartum depression screen completed";
        }
        break;
      }

      case "preeclampsia_risk_assessment": {
        if (!isPregnant && !isPostpartum) break;
        const hasPreeclampsiaProtocol = patient.carePlans.some(
          (cp) => cp.protocolType === "preeclampsia_prevention"
        );
        const hasRiskDocs = riskFactors.some(
          (f) =>
            f.includes("preeclamp") ||
            f.includes("hypertension") ||
            f.includes("blood_pressure")
        );
        if (!hasPreeclampsiaProtocol && !hasRiskDocs && ga > 12) {
          compliant = false;
          detail = "No preeclampsia risk assessment protocol documented";
        } else {
          detail = hasPreeclampsiaProtocol
            ? "Preeclampsia prevention protocol active"
            : "Risk factors documented";
        }
        break;
      }

      case "aspirin_high_risk": {
        if (!isPregnant) break;
        const isHighRisk =
          riskFactors.some((f) =>
            [
              "previous_preeclampsia",
              "multiple_gestation",
              "preexisting_hypertension",
              "diabetes",
              "chronic_kidney_disease",
              "autoimmune",
            ].some((r) => f.includes(r))
          ) ||
          patient.carePlans.some((cp) => cp.protocolType === "preeclampsia_prevention");

        if (!isHighRisk) break; // rule not applicable

        // Check if aspirin tracking is in their risk factors or protocol
        const aspirinTracked = riskFactors.some((f) => f.includes("aspirin"));
        if (ga >= 16 && !aspirinTracked) {
          compliant = false;
          detail = "High-risk patient — aspirin not documented by 16 weeks";
        } else if (ga < 16) {
          detail = "High-risk — aspirin should be started (not yet 16w)";
        } else {
          detail = "Aspirin use documented";
        }
        break;
      }
    }

    // Only push rules that are applicable (not skipped via break)
    if (detail !== "Compliant" || compliant) {
      results.push({
        patientId: patient.id,
        patientName,
        ruleId: rule.id as ComplianceRuleId,
        compliant,
        detail,
        status: patient.status as PatientComplianceResult["status"],
      });
    }
  }

  return results;
}

/**
 * Aggregate compliance stats across all patients.
 * Returns per-rule: total applicable, compliant count, rate.
 */
export interface ComplianceStat {
  rule: ComplianceRule;
  total: number;
  compliant: number;
  rate: number; // 0–100
  nonCompliantPatients: { id: string; name: string; detail: string }[];
}

export function aggregateCompliance(
  allResults: PatientComplianceResult[]
): ComplianceStat[] {
  return COMPLIANCE_RULES.map((rule) => {
    const ruleResults = allResults.filter((r) => r.ruleId === rule.id);
    const compliantCount = ruleResults.filter((r) => r.compliant).length;
    const total = ruleResults.length;
    return {
      rule,
      total,
      compliant: compliantCount,
      rate: total === 0 ? 100 : Math.round((compliantCount / total) * 100),
      nonCompliantPatients: ruleResults
        .filter((r) => !r.compliant)
        .map((r) => ({ id: r.patientId, name: r.patientName, detail: r.detail })),
    };
  });
}
