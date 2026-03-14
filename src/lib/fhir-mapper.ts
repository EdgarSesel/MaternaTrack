/**
 * FHIR R4 Mapper — MaternaTrack → HL7 FHIR R4
 *
 * Transforms internal data models to standards-compliant FHIR R4 resources.
 * Implements US Core profiles where applicable.
 *
 * References:
 *  - HL7 FHIR R4: https://hl7.org/fhir/R4/
 *  - US Core Implementation Guide 6.1: https://hl7.org/fhir/us/core/
 *  - LOINC codes: https://loinc.org/
 *  - 21st Century Cures Act: mandates FHIR R4 API access
 */

// ─── LOINC Code Map ─────────────────────────────────────────────────────────

export const VITAL_LOINC_MAP: Record<
  string,
  { code: string; display: string; system: string; unit?: string }
> = {
  bp: {
    code: "85354-9",
    display: "Blood pressure panel with all children optional",
    system: "http://loinc.org",
  },
  weight: {
    code: "29463-7",
    display: "Body weight",
    system: "http://loinc.org",
    unit: "lbs",
  },
  glucose: {
    code: "15074-8",
    display: "Glucose [Moles/volume] in Blood",
    system: "http://loinc.org",
    unit: "mg/dL",
  },
  heart_rate: {
    code: "8867-4",
    display: "Heart rate",
    system: "http://loinc.org",
    unit: "/min",
  },
  oxygen_saturation: {
    code: "59408-5",
    display: "Oxygen saturation in Arterial blood by Pulse oximetry",
    system: "http://loinc.org",
    unit: "%",
  },
  temperature: {
    code: "8310-5",
    display: "Body temperature",
    system: "http://loinc.org",
    unit: "[degF]",
  },
  fetal_movement: {
    code: "57088-6",
    display: "Fetal movement [#] during assessment period",
    system: "http://loinc.org",
    unit: "{count}",
  },
  urine_protein: {
    code: "2888-6",
    display: "Protein [Mass/volume] in Urine",
    system: "http://loinc.org",
  },
};

// BP component codes
const BP_SYSTOLIC_LOINC = { code: "8480-6", display: "Systolic blood pressure", system: "http://loinc.org" };
const BP_DIASTOLIC_LOINC = { code: "8462-4", display: "Diastolic blood pressure", system: "http://loinc.org" };

const GESTATIONAL_AGE_LOINC = {
  code: "49051-6",
  display: "Gestational age in weeks",
  system: "http://loinc.org",
};

// ─── Patient Types ───────────────────────────────────────────────────────────

interface FhirPatientInput {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gestationalAgeWeeks: number | null;
  dueDate: Date | null;
  status: string;
  riskScore: number;
  riskLevel: string;
  createdAt: Date;
}

interface FhirVitalInput {
  id: string;
  patientId: string;
  type: string;
  value: Record<string, unknown>;
  recordedAt: Date;
  source: string;
}

// ─── FHIR R4 Resource Builders ───────────────────────────────────────────────

export function toFhirPatient(patient: FhirPatientInput) {
  return {
    resourceType: "Patient",
    id: patient.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
      lastUpdated: patient.createdAt.toISOString(),
      source: "MaternaTrack",
    },
    identifier: [
      {
        system: "https://materna-track.dev/patients",
        value: patient.id,
      },
    ],
    name: [
      {
        use: "official",
        family: patient.lastName,
        given: [patient.firstName],
      },
    ],
    birthDate: patient.dateOfBirth.toISOString().slice(0, 10),
    // Note: gender not stored in our data model — FHIR requires it for US Core
    gender: "unknown",
    extension: [
      ...(patient.gestationalAgeWeeks != null
        ? [
            {
              url: "http://hl7.org/fhir/StructureDefinition/patient-gestationalAge",
              valueQuantity: {
                value: patient.gestationalAgeWeeks,
                unit: "weeks",
                system: "http://unitsofmeasure.org",
                code: "wk",
              },
            },
          ]
        : []),
      ...(patient.dueDate != null
        ? [
            {
              url: "https://materna-track.dev/fhir/StructureDefinition/expected-delivery-date",
              valueDate: patient.dueDate.toISOString().slice(0, 10),
            },
          ]
        : []),
      {
        url: "https://materna-track.dev/fhir/StructureDefinition/maternal-risk-score",
        valueInteger: patient.riskScore,
      },
      {
        url: "https://materna-track.dev/fhir/StructureDefinition/maternal-risk-level",
        valueCode: patient.riskLevel,
      },
    ],
  };
}

export function toFhirObservation(vital: FhirVitalInput) {
  const loinc = VITAL_LOINC_MAP[vital.type];
  const patientRef = `Patient/${vital.patientId}`;
  const effectiveDateTime = vital.recordedAt.toISOString();

  const base = {
    resourceType: "Observation",
    id: vital.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-clinical-result"],
      source: "MaternaTrack",
    },
    status: "final",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "vital-signs",
            display: "Vital Signs",
          },
        ],
      },
    ],
    code: loinc
      ? { coding: [{ system: loinc.system, code: loinc.code, display: loinc.display }] }
      : { text: vital.type },
    subject: { reference: patientRef },
    effectiveDateTime,
    issued: vital.recordedAt.toISOString(),
    method: {
      coding: [
        {
          system: "https://materna-track.dev/fhir/CodeSystem/vital-source",
          code: vital.source,
        },
      ],
    },
  };

  // Type-specific value mappings
  switch (vital.type) {
    case "bp": {
      const v = vital.value as { systolic?: number; diastolic?: number };
      return {
        ...base,
        component: [
          ...(v.systolic != null
            ? [
                {
                  code: { coding: [BP_SYSTOLIC_LOINC] },
                  valueQuantity: { value: v.systolic, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" },
                },
              ]
            : []),
          ...(v.diastolic != null
            ? [
                {
                  code: { coding: [BP_DIASTOLIC_LOINC] },
                  valueQuantity: { value: v.diastolic, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" },
                },
              ]
            : []),
        ],
      };
    }

    case "weight": {
      const v = vital.value as { value?: number; unit?: string };
      const isKg = v.unit === "kg";
      return {
        ...base,
        valueQuantity: {
          value: v.value,
          unit: v.unit ?? "lbs",
          system: "http://unitsofmeasure.org",
          code: isKg ? "kg" : "[lb_av]",
        },
      };
    }

    case "glucose": {
      const v = vital.value as { value?: number; context?: string };
      return {
        ...base,
        valueQuantity: {
          value: v.value,
          unit: "mg/dL",
          system: "http://unitsofmeasure.org",
          code: "mg/dL",
        },
        ...(v.context
          ? {
              extension: [
                {
                  url: "https://materna-track.dev/fhir/StructureDefinition/glucose-context",
                  valueCode: v.context,
                },
              ],
            }
          : {}),
      };
    }

    case "heart_rate": {
      const v = vital.value as { value?: number };
      return {
        ...base,
        valueQuantity: { value: v.value, unit: "/min", system: "http://unitsofmeasure.org", code: "/min" },
      };
    }

    case "oxygen_saturation": {
      const v = vital.value as { value?: number };
      return {
        ...base,
        valueQuantity: { value: v.value, unit: "%", system: "http://unitsofmeasure.org", code: "%" },
      };
    }

    case "temperature": {
      const v = vital.value as { value?: number; unit?: string };
      return {
        ...base,
        valueQuantity: {
          value: v.value,
          unit: v.unit === "C" ? "°C" : "°F",
          system: "http://unitsofmeasure.org",
          code: v.unit === "C" ? "Cel" : "[degF]",
        },
      };
    }

    case "fetal_movement": {
      const v = vital.value as { count?: number; period_hours?: number };
      return {
        ...base,
        valueQuantity: {
          value: v.count,
          unit: "movements",
          system: "http://unitsofmeasure.org",
          code: "{count}",
        },
        ...(v.period_hours != null
          ? {
              extension: [
                {
                  url: "https://materna-track.dev/fhir/StructureDefinition/fetal-movement-period",
                  valueQuantity: { value: v.period_hours, unit: "h", system: "http://unitsofmeasure.org", code: "h" },
                },
              ],
            }
          : {}),
      };
    }

    case "urine_protein": {
      const v = vital.value as { result?: string };
      return {
        ...base,
        valueString: v.result,
      };
    }

    default:
      return { ...base, valueString: JSON.stringify(vital.value) };
  }
}

export function toFhirGestationalAgeObservation(
  patientId: string,
  gestationalAgeWeeks: number,
  recordedAt: Date,
) {
  return {
    resourceType: "Observation",
    meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-clinical-result"] },
    status: "final",
    code: { coding: [{ system: GESTATIONAL_AGE_LOINC.system, code: GESTATIONAL_AGE_LOINC.code, display: GESTATIONAL_AGE_LOINC.display }] },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: recordedAt.toISOString(),
    valueQuantity: { value: gestationalAgeWeeks, unit: "weeks", system: "http://unitsofmeasure.org", code: "wk" },
  };
}

export function toFhirBundle(
  resources: unknown[],
  bundleType: "collection" | "searchset" = "collection",
  total?: number,
) {
  return {
    resourceType: "Bundle",
    id: `bundle-${Date.now()}`,
    meta: { lastUpdated: new Date().toISOString() },
    type: bundleType,
    total: total ?? resources.length,
    entry: resources.map((resource) => ({
      fullUrl: `urn:uuid:${(resource as { id?: string }).id ?? Math.random().toString(36).slice(2)}`,
      resource,
    })),
  };
}
