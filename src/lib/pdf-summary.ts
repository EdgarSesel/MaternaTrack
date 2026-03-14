/**
 * PDF Patient Summary Generator
 *
 * Generates a professional one-page clinical summary PDF for referrals,
 * handoffs, or patient records using @react-pdf/renderer.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import type { Patient, Vital, Screening, CarePlan, CareTask, TimelineEvent } from "@/generated/prisma/client";

const RISK_COLOR: Record<string, string> = {
  LOW: "#22c55e",
  MODERATE: "#eab308",
  HIGH: "#f97316",
  VERY_HIGH: "#ef4444",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 36,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#e11d48",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandDot: {
    width: 10,
    height: 10,
    backgroundColor: "#e11d48",
    borderRadius: 2,
  },
  brandName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
  },
  reportMeta: {
    fontSize: 8,
    color: "#64748b",
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 14,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  label: {
    fontSize: 9,
    color: "#64748b",
    width: 100,
  },
  value: {
    fontSize: 9,
    color: "#1e293b",
    flex: 1,
  },
  riskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    alignSelf: "flex-start",
  },
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  th: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    flex: 1,
  },
  td: {
    fontSize: 8,
    color: "#334155",
    flex: 1,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: "#94a3b8",
  },
});

interface PatientSummaryData {
  patient: Patient & {
    vitals: Vital[];
    screenings: Screening[];
    carePlans: (CarePlan & { tasks: CareTask[] })[];
    timelineEvents: TimelineEvent[];
  };
}

function formatVitalValue(type: string, value: unknown): string {
  const v = value as Record<string, unknown>;
  if (type === "bp") return `${v.systolic}/${v.diastolic} mmHg`;
  if (type === "weight") return `${v.value} ${v.unit}`;
  if (type === "glucose") return `${v.value} mg/dL`;
  if (type === "heart_rate") return `${v.value} bpm`;
  if (type === "temperature") return `${v.value}°${v.unit}`;
  if (type === "oxygen_saturation") return `${v.value}%`;
  if (type === "urine_protein") return String(v.result);
  return JSON.stringify(value);
}

function PatientSummaryDocument({ patient }: PatientSummaryData) {
  const recentVitals = patient.vitals.slice(-8).reverse();
  const recentScreenings = patient.screenings.slice(-5);
  const activePlans = patient.carePlans.filter((p) => p.status === "active");
  const recentEvents = patient.timelineEvents.slice(-8).reverse();
  const riskColor = RISK_COLOR[patient.riskLevel] ?? "#94a3b8";
  const generatedAt = format(new Date(), "MMM d, yyyy 'at' h:mm a");

  return React.createElement(
    Document,
    { title: `Patient Summary — ${patient.firstName} ${patient.lastName}` },
    React.createElement(
      Page,
      { size: "A4", style: styles.page },

      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          null,
          React.createElement(
            View,
            { style: styles.brandRow },
            React.createElement(View, { style: styles.brandDot }),
            React.createElement(Text, { style: styles.brandName }, "MaternaTrack")
          ),
          React.createElement(Text, { style: { fontSize: 8, color: "#64748b", marginTop: 2 } }, "Clinical Patient Summary")
        ),
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.reportMeta }, `Generated: ${generatedAt}`),
          React.createElement(Text, { style: styles.reportMeta }, "CONFIDENTIAL — For provider use only")
        )
      ),

      // Demographics
      React.createElement(Text, { style: styles.sectionTitle }, "Patient Demographics"),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(Text, { style: styles.label }, "Name"),
        React.createElement(Text, { style: styles.value }, `${patient.firstName} ${patient.lastName}`)
      ),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(Text, { style: styles.label }, "Date of Birth"),
        React.createElement(Text, { style: styles.value }, format(new Date(patient.dateOfBirth), "MMM d, yyyy"))
      ),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(Text, { style: styles.label }, "Status"),
        React.createElement(Text, { style: styles.value }, patient.status)
      ),
      patient.gestationalAgeWeeks != null &&
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, "Gestational Age"),
          React.createElement(Text, { style: styles.value }, `${patient.gestationalAgeWeeks} weeks`)
        ),
      patient.dueDate &&
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, "Due Date"),
          React.createElement(Text, { style: styles.value }, format(new Date(patient.dueDate), "MMM d, yyyy"))
        ),
      patient.insuranceType &&
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, "Insurance"),
          React.createElement(Text, { style: styles.value }, patient.insuranceType)
        ),

      // Risk Profile
      React.createElement(Text, { style: styles.sectionTitle }, "Risk Profile"),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(Text, { style: styles.label }, "Risk Score"),
        React.createElement(Text, { style: styles.value }, `${patient.riskScore} / 100`)
      ),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(Text, { style: styles.label }, "Risk Level"),
        React.createElement(
          Text,
          { style: { ...styles.riskBadge, backgroundColor: riskColor } },
          patient.riskLevel.replace("_", " ")
        )
      ),

      // Recent Vitals
      recentVitals.length > 0 &&
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.sectionTitle }, "Recent Vitals"),
          React.createElement(
            View,
            { style: styles.table },
            React.createElement(
              View,
              { style: styles.tableHeader },
              React.createElement(Text, { style: { ...styles.th, flex: 2 } }, "Type"),
              React.createElement(Text, { style: { ...styles.th, flex: 2 } }, "Value"),
              React.createElement(Text, { style: { ...styles.th, flex: 2 } }, "Date")
            ),
            ...recentVitals.map((v) =>
              React.createElement(
                View,
                { key: v.id, style: styles.tableRow },
                React.createElement(Text, { style: { ...styles.td, flex: 2 } }, v.type.replace(/_/g, " ")),
                React.createElement(Text, { style: { ...styles.td, flex: 2 } }, formatVitalValue(v.type, v.value)),
                React.createElement(Text, { style: { ...styles.td, flex: 2 } }, format(new Date(v.recordedAt), "MMM d, yyyy"))
              )
            )
          )
        ),

      // Screening History
      recentScreenings.length > 0 &&
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.sectionTitle }, "Screening History"),
          React.createElement(
            View,
            { style: styles.table },
            React.createElement(
              View,
              { style: styles.tableHeader },
              React.createElement(Text, { style: { ...styles.th, flex: 2 } }, "Type"),
              React.createElement(Text, { style: styles.th }, "Score"),
              React.createElement(Text, { style: { ...styles.th, flex: 2 } }, "Result"),
              React.createElement(Text, { style: { ...styles.th, flex: 2 } }, "Date")
            ),
            ...recentScreenings.map((s) =>
              React.createElement(
                View,
                { key: s.id, style: styles.tableRow },
                React.createElement(Text, { style: { ...styles.td, flex: 2 } }, s.type.toUpperCase()),
                React.createElement(Text, { style: styles.td }, s.score != null ? String(s.score) : "—"),
                React.createElement(Text, { style: { ...styles.td, flex: 2 } }, s.riskResult ?? "—"),
                React.createElement(Text, { style: { ...styles.td, flex: 2 } }, format(new Date(s.administeredAt), "MMM d, yyyy"))
              )
            )
          )
        ),

      // Active Care Plans
      activePlans.length > 0 &&
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.sectionTitle }, "Active Care Plans"),
          ...activePlans.map((plan) =>
            React.createElement(
              View,
              { key: plan.id, style: { marginBottom: 4 } },
              React.createElement(
                View,
                { style: styles.row },
                React.createElement(Text, { style: styles.label }, "Protocol"),
                React.createElement(Text, { style: styles.value }, plan.protocolType.replace(/_/g, " "))
              ),
              React.createElement(
                View,
                { style: styles.row },
                React.createElement(Text, { style: styles.label }, "Activated"),
                React.createElement(Text, { style: styles.value }, format(new Date(plan.activatedAt), "MMM d, yyyy"))
              ),
              React.createElement(
                View,
                { style: styles.row },
                React.createElement(Text, { style: styles.label }, "Open Tasks"),
                React.createElement(
                  Text,
                  { style: styles.value },
                  String(plan.tasks.filter((t) => t.status === "PENDING" || t.status === "OVERDUE").length)
                )
              )
            )
          )
        ),

      // Recent Timeline
      recentEvents.length > 0 &&
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.sectionTitle }, "Recent Timeline"),
          React.createElement(
            View,
            { style: styles.table },
            React.createElement(
              View,
              { style: styles.tableHeader },
              React.createElement(Text, { style: { ...styles.th, flex: 3 } }, "Event"),
              React.createElement(Text, { style: { ...styles.th, flex: 2 } }, "Date")
            ),
            ...recentEvents.map((e) =>
              React.createElement(
                View,
                { key: e.id, style: styles.tableRow },
                React.createElement(Text, { style: { ...styles.td, flex: 3 } }, e.title),
                React.createElement(Text, { style: { ...styles.td, flex: 2 } }, format(new Date(e.createdAt), "MMM d, yyyy"))
              )
            )
          )
        ),

      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(Text, { style: styles.footerText }, "MaternaTrack — Pomelo Care Demo"),
        React.createElement(Text, { style: styles.footerText }, `Generated: ${generatedAt}`)
      )
    )
  );
}

export async function generatePatientSummaryPdf(
  patient: PatientSummaryData["patient"]
): Promise<Buffer> {
  const element = React.createElement(PatientSummaryDocument, { patient });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any);
}
