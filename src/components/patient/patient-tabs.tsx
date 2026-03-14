"use client";

import { useState, useCallback } from "react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/patient/overview-tab";
import { TimelineTab } from "@/components/patient/timeline-tab";
import { CarePlanTab } from "@/components/patient/care-plan-tab";
import { MessagesTab } from "@/components/patient/messages-tab";
import { VisitNoteEditor } from "@/components/patient/visit-note-editor";
import { BabyOverview } from "@/components/patient/baby-overview";
import { AiClinicalChat } from "@/components/patient/ai-clinical-chat";
import type {
  Patient,
  Vital,
  Screening,
  CarePlan,
  CareTask,
  Message,
  TimelineEvent,
  RiskScoreHistory,
  Appointment,
  VisitNote,
  Provider,
  Baby,
  NeonatalVital,
} from "@/generated/prisma/client";

type NoteWithProvider = VisitNote & {
  provider: Pick<Provider, "name" | "role">;
};

type BabyWithVitals = Baby & { neonatalVitals: NeonatalVital[] };

type PatientData = Patient & {
  vitals: Vital[];
  screenings: Screening[];
  carePlans: (CarePlan & { tasks: CareTask[] })[];
  careTasks: CareTask[];
  messages: Message[];
  timelineEvents: TimelineEvent[];
  riskScoreHistory: RiskScoreHistory[];
  appointments: Appointment[];
  visitNotes: NoteWithProvider[];
  babies: BabyWithVitals[];
};

interface Props {
  patient: PatientData;
}

const BASE_TAB_KEYS = ["overview", "timeline", "careplan", "messages", "notes"];

export function PatientTabs({ patient }: Props) {
  const isPostpartum = patient.status === "POSTPARTUM";
  const tabKeys = isPostpartum ? [...BASE_TAB_KEYS, "baby"] : BASE_TAB_KEYS;

  const [activeTab, setActiveTab] = useState("overview");

  const switchTab = useCallback((idx: number) => {
    if (tabKeys[idx]) setActiveTab(tabKeys[idx]);
  }, [tabKeys]);

  useKeyboardShortcuts([
    { key: "1", handler: () => switchTab(0) },
    { key: "2", handler: () => switchTab(1) },
    { key: "3", handler: () => switchTab(2) },
    { key: "4", handler: () => switchTab(3) },
    { key: "5", handler: () => switchTab(4) },
    { key: "6", handler: () => switchTab(5) },
  ]);

  const overdueCount = patient.careTasks.filter(
    (t) => t.status === "OVERDUE" || t.status === "PENDING"
  ).length;

  const unreadMessages = patient.messages.filter(
    (m) => m.senderType === "PATIENT" && !m.readAt
  ).length;

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "timeline", label: "Timeline", count: patient.timelineEvents.length },
    {
      value: "careplan",
      label: "Care Plan",
      count: overdueCount > 0 ? overdueCount : undefined,
      countClass: "bg-orange-100 text-orange-700",
    },
    {
      value: "messages",
      label: "Messages",
      count: unreadMessages > 0 ? unreadMessages : undefined,
      countClass: "bg-rose-100 text-rose-700",
    },
    {
      value: "notes",
      label: "Visit Notes",
      count: patient.visitNotes.length > 0 ? patient.visitNotes.length : undefined,
    },
    ...(isPostpartum
      ? [
          {
            value: "baby",
            label: "Baby",
            count: patient.babies.length > 0 ? patient.babies.length : undefined,
            countClass: "bg-pink-100 text-pink-700",
          },
        ]
      : []),
  ];

  return (
    <>
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="border-b border-slate-200 w-full justify-start rounded-none bg-transparent h-auto pb-0 gap-0">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-rose-600 data-[state=active]:text-rose-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full font-medium ${tab.countClass ?? "bg-slate-100 text-slate-600"}`}
              >
                {tab.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="mt-5">
        <TabsContent value="overview" className="mt-0">
          <OverviewTab patient={patient} patientId={patient.id} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-0">
          <TimelineTab events={patient.timelineEvents} />
        </TabsContent>
        <TabsContent value="careplan" className="mt-0">
          <CarePlanTab
            tasks={patient.careTasks}
            carePlans={patient.carePlans}
            patientId={patient.id}
          />
        </TabsContent>
        <TabsContent value="messages" className="mt-0">
          <MessagesTab
            messages={patient.messages}
            patientId={patient.id}
            patientFirstName={patient.firstName}
          />
        </TabsContent>
        <TabsContent value="notes" className="mt-0">
          <VisitNoteEditor patientId={patient.id} notes={patient.visitNotes} />
        </TabsContent>
        {isPostpartum && (
          <TabsContent value="baby" className="mt-0">
            <BabyOverview patientId={patient.id} babies={patient.babies} />
          </TabsContent>
        )}
      </div>
    </Tabs>

    {/* Floating AI Clinical Copilot — rendered outside Tabs so it overlays the full page */}
    <AiClinicalChat
      patientId={patient.id}
      patientName={`${patient.firstName} ${patient.lastName}`}
    />
    </>
  );
}
