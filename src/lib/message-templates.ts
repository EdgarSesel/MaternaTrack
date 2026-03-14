/**
 * Pre-built message templates for common provider outreach scenarios.
 * Variables: {{firstName}}, {{nextAppointment}}, {{screeningType}}, {{providerName}}
 */

export interface MessageTemplate {
  id: string;
  label: string;
  category: "appointment" | "screening" | "lab" | "check_in" | "education";
  body: string;
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  // --- Appointments ---
  {
    id: "missed_appointment",
    label: "Missed Appointment Follow-Up",
    category: "appointment",
    body: "Hi {{firstName}}, we noticed you weren't able to make your recent appointment. We understand things come up! Please give us a call or reply here so we can reschedule at a time that works for you. We're here to support you. 💙",
  },
  {
    id: "appointment_reminder",
    label: "Appointment Reminder",
    category: "appointment",
    body: "Hi {{firstName}}, just a friendly reminder that your appointment is coming up on {{nextAppointment}}. Please let us know if you need to reschedule or if you have any questions beforehand. See you soon!",
  },
  {
    id: "appointment_confirmation",
    label: "Appointment Confirmation",
    category: "appointment",
    body: "Hi {{firstName}}, your appointment has been confirmed for {{nextAppointment}}. Please arrive 10 minutes early and bring your insurance card. Reply here if you have any questions. We look forward to seeing you!",
  },

  // --- Screenings ---
  {
    id: "screening_reminder",
    label: "Screening Reminder",
    category: "screening",
    body: "Hi {{firstName}}, it's time for your {{screeningType}} screening. This is a quick and important check-in for your wellbeing. Please let us know when you're available to complete it — it only takes a few minutes. 💙",
  },
  {
    id: "depression_screening",
    label: "Depression Screening Outreach",
    category: "screening",
    body: "Hi {{firstName}}, we check in on emotional wellbeing as part of your prenatal care. We'd like to complete a brief wellness questionnaire with you. How are you feeling lately? Reply here or we can go through it at your next visit.",
  },

  // --- Lab Results ---
  {
    id: "lab_results_normal",
    label: "Lab Results — Normal",
    category: "lab",
    body: "Hi {{firstName}}, your recent lab results came back and everything looks normal! No action needed right now. Feel free to reply if you have any questions. Keep up the great work! 🌟",
  },
  {
    id: "lab_results_review",
    label: "Lab Results — Needs Review",
    category: "lab",
    body: "Hi {{firstName}}, your recent lab results are ready for review. I'd like to discuss them with you. Can you call us or schedule a quick follow-up? It's nothing to worry about — we just want to go over a few things together.",
  },

  // --- Check-In ---
  {
    id: "weekly_checkin",
    label: "Weekly Check-In",
    category: "check_in",
    body: "Hi {{firstName}}, just checking in to see how you're doing this week! How are you feeling? Any questions, concerns, or anything you'd like to discuss? We're always here for you. 💙",
  },
  {
    id: "no_contact_checkin",
    label: "Haven't Heard From You",
    category: "check_in",
    body: "Hi {{firstName}}, we've been thinking of you and wanted to reach out. We noticed it's been a little while since we connected. Is everything okay? Please don't hesitate to reach out — we're here to support you through every step of this journey.",
  },
  {
    id: "vitals_reminder",
    label: "Vitals Logging Reminder",
    category: "check_in",
    body: "Hi {{firstName}}, just a reminder to log your vitals in the patient portal when you have a moment. Tracking your readings helps us make sure everything is going smoothly. Thank you for staying on top of your health! 🌿",
  },

  // --- Education ---
  {
    id: "nutrition_tips",
    label: "Nutrition & Hydration Tips",
    category: "education",
    body: "Hi {{firstName}}, I wanted to share a quick reminder about staying hydrated and getting enough nutrients during your pregnancy. Aim for at least 8–10 glasses of water a day and include plenty of fruits, veggies, and lean protein. Reply if you have any dietary questions!",
  },
  {
    id: "warning_signs",
    label: "Warning Signs to Watch For",
    category: "education",
    body: "Hi {{firstName}}, as part of your prenatal care we want to make sure you know when to reach out right away: severe headaches, sudden swelling in your hands or face, decreased fetal movement, or bleeding. Please don't hesitate to call or message us — your safety comes first. 💙",
  },
];

export function applyTemplateVariables(
  template: MessageTemplate,
  variables: {
    firstName?: string;
    nextAppointment?: string;
    screeningType?: string;
    providerName?: string;
  }
): string {
  let text = template.body;
  if (variables.firstName) text = text.replace(/\{\{firstName\}\}/g, variables.firstName);
  if (variables.nextAppointment) text = text.replace(/\{\{nextAppointment\}\}/g, variables.nextAppointment);
  if (variables.screeningType) text = text.replace(/\{\{screeningType\}\}/g, variables.screeningType);
  if (variables.providerName) text = text.replace(/\{\{providerName\}\}/g, variables.providerName);
  return text;
}

export const CATEGORY_LABELS: Record<MessageTemplate["category"], string> = {
  appointment: "Appointments",
  screening: "Screenings",
  lab: "Lab Results",
  check_in: "Check-In",
  education: "Education",
};
