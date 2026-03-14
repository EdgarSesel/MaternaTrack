"use client";

import { useState, useTransition } from "react";
import { administerScreening } from "@/app/actions/screening-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Loader2, ChevronRight, ChevronLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import {
  SCREENING_DEFINITIONS,
  SCREENING_TYPE_LABELS,
  GDM_SCREEN,
  computeScreeningResult,
  computeGdmResult,
  type ScreeningDefinition,
  type GdmScreenDefinition,
} from "@/lib/screening-definitions";

interface Props {
  patientId: string;
  patientStatus: string;
}

type Step = "select" | "questions" | "result";

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  moderate: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-red-100 text-red-800 border-red-200",
  positive: "bg-orange-100 text-orange-800 border-orange-200",
  negative: "bg-green-100 text-green-800 border-green-200",
};

function isGdmDefinition(
  def: ScreeningDefinition | GdmScreenDefinition
): def is GdmScreenDefinition {
  return def.type === "gdm_screen";
}

export function AdministerScreeningDialog({ patientId, patientStatus }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [screeningType, setScreeningType] = useState<string>("phq9");
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [questionPage, setQuestionPage] = useState(0);
  const [result, setResult] = useState<{
    score: number | null;
    riskResult: string;
    label: string;
    description: string;
    action: string;
    flaggedFactors?: string[];
  } | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const definition = SCREENING_DEFINITIONS[screeningType];
  const QUESTIONS_PER_PAGE = 3;

  function reset() {
    setStep("select");
    setScreeningType("phq9");
    setResponses({});
    setQuestionPage(0);
    setResult(null);
    setError("");
  }

  function handleOpen(v: boolean) {
    setOpen(v);
    if (!v) reset();
  }

  function handleStartScreening() {
    setResponses({});
    setQuestionPage(0);
    setStep("questions");
  }

  function setResponse(questionId: string, value: number) {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  }

  function handlePreviewResult() {
    if (!definition) return;

    if (isGdmDefinition(definition)) {
      const r = computeGdmResult(responses);
      setResult({
        score: null,
        riskResult: r.riskResult,
        label: r.label,
        description: r.description,
        action: r.action,
        flaggedFactors: r.flaggedFactors,
      });
    } else {
      const r = computeScreeningResult(definition, responses);
      setResult({
        score: r.score,
        riskResult: r.riskResult,
        label: r.label,
        description: r.description,
        action: r.action,
      });
    }

    setStep("result");
  }

  function handleSave() {
    setError("");
    startTransition(async () => {
      const res = await administerScreening({
        patientId,
        type: screeningType,
        responses,
        administeredAt: new Date().toISOString(),
      });

      if (res.success) {
        setOpen(false);
        toast.success("Screening recorded successfully");
      } else {
        setError(res.error ?? "Failed to save screening");
      }
    });
  }

  // Paginate questions
  const allQuestions = definition
    ? isGdmDefinition(definition)
      ? definition.questions
      : definition.questions
    : [];

  const totalPages = Math.ceil(allQuestions.length / QUESTIONS_PER_PAGE);
  const pageQuestions = allQuestions.slice(
    questionPage * QUESTIONS_PER_PAGE,
    (questionPage + 1) * QUESTIONS_PER_PAGE
  );

  const pageAnswered = pageQuestions.every((q) => responses[q.id] !== undefined);
  const allAnswered = allQuestions.every((q) => responses[q.id] !== undefined);

  // Relevant screening types based on patient status
  const relevantTypes = Object.entries(SCREENING_TYPE_LABELS).filter(([type]) => {
    if (type === "epds" && patientStatus !== "POSTPARTUM") return false;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs h-7">
          <ClipboardList className="w-3.5 h-3.5 mr-1" />
          Administer Screening
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Select Screening Tool"}
            {step === "questions" && (
              <span>
                {SCREENING_TYPE_LABELS[screeningType]}{" "}
                <span className="text-slate-400 font-normal text-sm">
                  — Page {questionPage + 1} of {totalPages}
                </span>
              </span>
            )}
            {step === "result" && "Screening Result"}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Select tool ── */}
        {step === "select" && (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Screening tool</label>
              <Select value={screeningType} onValueChange={setScreeningType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {relevantTypes.map(([type, label]) => (
                    <SelectItem key={type} value={type}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {definition && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-sm">
                <p className="font-medium text-slate-800">{definition.name}</p>
                <p className="text-slate-600">{definition.description}</p>
                {!isGdmDefinition(definition) && (
                  <p className="text-slate-500">
                    {definition.totalItems} questions · Score range 0–{definition.maxScore}
                  </p>
                )}
                {isGdmDefinition(definition) && (
                  <p className="text-slate-500">{GDM_SCREEN.questions.length} risk factor questions</p>
                )}
                <p className="text-xs text-slate-500 italic border-t border-slate-200 pt-1.5 mt-1.5">
                  {definition.instructions}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleStartScreening}
                disabled={!screeningType}
                className="flex-1 bg-rose-600 hover:bg-rose-700"
              >
                Start Screening
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Questions ── */}
        {step === "questions" && definition && (
          <div className="space-y-4 mt-2">
            {/* Instructions */}
            <p className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-md px-3 py-2 italic">
              {definition.instructions}
            </p>

            {/* Question list for this page */}
            <div className="space-y-5">
              {pageQuestions.map((q, idx) => (
                <div key={q.id} className="space-y-2">
                  <p className="text-sm font-medium text-slate-800 leading-snug">
                    <span className="text-slate-400 mr-1.5">
                      {questionPage * QUESTIONS_PER_PAGE + idx + 1}.
                    </span>
                    {q.text}
                  </p>
                  <div className="space-y-1.5">
                    {q.options.map((opt) => {
                      const selected = responses[q.id] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setResponse(q.id, opt.value)}
                          className={`w-full text-left text-sm px-3 py-2 rounded-md border transition-colors ${
                            selected
                              ? "bg-rose-50 border-rose-300 text-rose-800 font-medium"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuestionPage((p) => p - 1)}
                disabled={questionPage === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>

              <span className="text-xs text-slate-400">
                {Object.keys(responses).length} / {allQuestions.length} answered
              </span>

              {questionPage < totalPages - 1 ? (
                <Button
                  size="sm"
                  onClick={() => setQuestionPage((p) => p + 1)}
                  disabled={!pageAnswered}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handlePreviewResult}
                  disabled={!allAnswered}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  View Result
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Result ── */}
        {step === "result" && result && (
          <div className="space-y-4 mt-2">
            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 text-lg">
                  {SCREENING_TYPE_LABELS[screeningType]}
                </span>
                {result.score !== null && (
                  <span className="text-2xl font-bold text-slate-800">{result.score}</span>
                )}
              </div>

              <Badge
                className={`text-sm px-3 py-1 font-medium border ${
                  RISK_COLORS[result.riskResult] ?? "bg-slate-100 text-slate-700"
                }`}
              >
                {result.label}
              </Badge>

              <p className="text-sm text-slate-600">{result.description}</p>

              {result.flaggedFactors && result.flaggedFactors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Flagged Risk Factors
                  </p>
                  <ul className="space-y-0.5">
                    {result.flaggedFactors.map((f, i) => (
                      <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                        <span className="text-orange-500 mt-0.5">•</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
                <p className="text-xs font-medium text-blue-700 mb-0.5">Recommended Action</p>
                <p className="text-sm text-blue-800">{result.action}</p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 bg-rose-600 hover:bg-rose-700"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save to Record
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setStep("questions")}>
                Review Answers
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
