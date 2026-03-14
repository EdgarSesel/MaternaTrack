"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Users,
  Brain,
  Sparkles,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { markOnboarded } from "@/app/actions/onboarding-actions";

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  detail: React.ReactNode;
}

const STEPS: Step[] = [
  {
    icon: <Heart className="w-8 h-8 text-rose-500" />,
    title: "Welcome to MaternaTrack",
    description: "AI-powered maternal care coordination for high-risk pregnancies",
    detail: (
      <ul className="space-y-2 text-sm text-slate-600">
        <li className="flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          Manage your panel of high-risk pregnant patients
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          Track vitals, screenings, and care plans in one place
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          Get AI-powered risk summaries and care gap detection
        </li>
      </ul>
    ),
  },
  {
    icon: <Users className="w-8 h-8 text-blue-500" />,
    title: "Your Patient Panel",
    description: "All your patients are visible on the dashboard",
    detail: (
      <div className="space-y-3 text-sm text-slate-600">
        <p>Use the <strong>Dashboard</strong> to see all your patients sorted by risk score.</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded bg-red-50 border border-red-100">
            <div className="font-semibold text-red-700">Very High Risk</div>
            <div className="text-red-600">Score 76–100</div>
          </div>
          <div className="p-2 rounded bg-orange-50 border border-orange-100">
            <div className="font-semibold text-orange-700">High Risk</div>
            <div className="text-orange-600">Score 51–75</div>
          </div>
          <div className="p-2 rounded bg-yellow-50 border border-yellow-100">
            <div className="font-semibold text-yellow-700">Moderate</div>
            <div className="text-yellow-600">Score 26–50</div>
          </div>
          <div className="p-2 rounded bg-green-50 border border-green-100">
            <div className="font-semibold text-green-700">Low Risk</div>
            <div className="text-green-600">Score 0–25</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: <Brain className="w-8 h-8 text-purple-500" />,
    title: "AI Clinical Support",
    description: "Streaming AI summaries and care gap detection on every patient",
    detail: (
      <ul className="space-y-2 text-sm text-slate-600">
        <li className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
          <span><strong>Risk Summary</strong> — Natural-language overview of each patient&apos;s current status</span>
        </li>
        <li className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
          <span><strong>Care Gaps</strong> — Identifies overdue screenings and protocol steps with clinical rationale</span>
        </li>
        <li className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
          <span><strong>Message Drafts</strong> — Suggests personalized outreach messages for patient contact</span>
        </li>
        <li className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
          <span><strong>Daily Worklist</strong> — AI-prioritized list of who needs attention today</span>
        </li>
      </ul>
    ),
  },
  {
    icon: <CheckCircle className="w-8 h-8 text-green-500" />,
    title: "You're all set!",
    description: "Start by reviewing your patients or adding a new one",
    detail: (
      <div className="space-y-3 text-sm text-slate-600">
        <p>Quick tips for power users:</p>
        <ul className="space-y-1.5">
          <li>• Press <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 border border-slate-300 rounded font-mono">/</kbd> to focus patient search</li>
          <li>• Press <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 border border-slate-300 rounded font-mono">j</kbd>/<kbd className="px-1.5 py-0.5 text-xs bg-slate-100 border border-slate-300 rounded font-mono">k</kbd> to navigate the patient list</li>
          <li>• Press <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 border border-slate-300 rounded font-mono">?</kbd> to see all keyboard shortcuts</li>
          <li>• Press <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 border border-slate-300 rounded font-mono">1</kbd>–<kbd className="px-1.5 py-0.5 text-xs bg-slate-100 border border-slate-300 rounded font-mono">5</kbd> to switch patient tabs</li>
        </ul>
      </div>
    ),
  },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function handleClose() {
    startTransition(async () => {
      await markOnboarded();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="items-center text-center pt-2">
          <div className="mb-3">{currentStep.icon}</div>
          <DialogTitle className="text-lg">{currentStep.title}</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">{currentStep.description}</p>
        </DialogHeader>

        <div className="py-2">{currentStep.detail}</div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 py-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-rose-500" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        <div className="flex justify-between items-center pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {isLast ? (
            <Button onClick={handleClose} disabled={isPending}>
              {isPending ? "Setting up…" : "Get Started"}
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
