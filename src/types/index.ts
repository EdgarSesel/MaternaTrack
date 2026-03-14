import type {
  Patient,
  Provider,
  Vital,
  Screening,
  CarePlan,
  CareTask,
  Message,
  TimelineEvent,
  RiskScoreHistory,
  Appointment,
  ProviderRole,
  PatientStatus,
  RiskLevel,
  TaskStatus,
  MessageSenderType,
} from "@/generated/prisma/client";

export type {
  Patient,
  Provider,
  Vital,
  Screening,
  CarePlan,
  CareTask,
  Message,
  TimelineEvent,
  RiskScoreHistory,
  Appointment,
  ProviderRole,
  PatientStatus,
  RiskLevel,
  TaskStatus,
  MessageSenderType,
};

export type PatientWithRelations = Patient & {
  vitals?: Vital[];
  screenings?: Screening[];
  carePlans?: (CarePlan & { tasks?: CareTask[] })[];
  careTasks?: CareTask[];
  messages?: Message[];
  timelineEvents?: TimelineEvent[];
  riskScoreHistory?: RiskScoreHistory[];
  appointments?: Appointment[];
};

export type PatientListItem = Pick<
  Patient,
  | "id"
  | "firstName"
  | "lastName"
  | "dateOfBirth"
  | "gestationalAgeWeeks"
  | "dueDate"
  | "status"
  | "riskScore"
  | "riskLevel"
  | "riskFactors"
  | "lastContactAt"
  | "lastContactChannel"
  | "insuranceType"
> & {
  _count: {
    messages: number;
    careTasks: number;
  };
  careTasks: Pick<CareTask, "id" | "status" | "dueDate">[];
};

export const RISK_COLORS = {
  LOW: "#22c55e",
  MODERATE: "#eab308",
  HIGH: "#f97316",
  VERY_HIGH: "#ef4444",
} as const;

export const RISK_BG_CLASSES = {
  LOW: "bg-green-50 text-green-700 border-green-200",
  MODERATE: "bg-yellow-50 text-yellow-700 border-yellow-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  VERY_HIGH: "bg-red-50 text-red-700 border-red-200",
} as const;

export const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
  SNOOZED: "Snoozed",
  NOT_APPLICABLE: "N/A",
};

export const PATIENT_STATUS_LABELS: Record<string, string> = {
  PRECONCEPTION: "Preconception",
  PREGNANT: "Pregnant",
  POSTPARTUM: "Postpartum",
  INACTIVE: "Inactive",
};
