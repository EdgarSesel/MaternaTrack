"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createVisitNote,
  updateVisitNote,
  signVisitNote,
} from "@/app/actions/visit-note-actions";
import type { VisitNote, Provider } from "@/generated/prisma/client";
import {
  FileText,
  PenLine,
  Sparkles,
  CheckCircle,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  Lock,
} from "lucide-react";
import { useAiStream } from "@/hooks/use-ai-stream";

type NoteWithProvider = VisitNote & {
  provider: Pick<Provider, "name" | "role">;
};

interface SoapSection {
  key: "subjective" | "objective" | "assessment" | "plan";
  label: string;
  placeholder: string;
  color: string;
}

const SOAP_SECTIONS: SoapSection[] = [
  {
    key: "subjective",
    label: "S — Subjective",
    placeholder: "What the patient reports: symptoms, concerns, complaints...",
    color: "text-blue-700",
  },
  {
    key: "objective",
    label: "O — Objective",
    placeholder: "Measurable findings: vitals, exam results, lab values...",
    color: "text-green-700",
  },
  {
    key: "assessment",
    label: "A — Assessment",
    placeholder: "Clinical interpretation of subjective + objective findings...",
    color: "text-amber-700",
  },
  {
    key: "plan",
    label: "P — Plan",
    placeholder: "Next steps, follow-ups, orders, referrals, patient education...",
    color: "text-purple-700",
  },
];

interface EditorProps {
  patientId: string;
  note?: NoteWithProvider;
  onSaved?: () => void;
  onCancel?: () => void;
  isNew?: boolean;
}

function NoteEditor({ patientId, note, onSaved, onCancel, isNew = false }: EditorProps) {
  const [form, setForm] = useState({
    subjective: note?.subjective ?? "",
    objective: note?.objective ?? "",
    assessment: note?.assessment ?? "",
    plan: note?.plan ?? "",
  });
  const [isPending, startTransition] = useTransition();
  const { text: aiText, isStreaming: aiStreaming, start: startAiStream, reset: resetAiStream } = useAiStream();
  const parsedRef = useRef(false);

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // When AI stream finishes, parse JSON and populate form
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!aiStreaming && aiText && !parsedRef.current) {
      parsedRef.current = true;
      try {
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as Partial<typeof form>;
          setForm((prev) => ({
            subjective: parsed.subjective ?? prev.subjective,
            objective: parsed.objective ?? prev.objective,
            assessment: parsed.assessment ?? prev.assessment,
            plan: parsed.plan ?? prev.plan,
          }));
          toast.success("AI draft applied — review and edit before saving");
        }
      } catch {
        toast.error("Could not parse AI draft");
      }
    }
  }, [aiStreaming, aiText]);

  async function handleAiDraft() {
    parsedRef.current = false;
    resetAiStream();
    await startAiStream("/api/ai/visit-note-draft", { patientId });
  }

  function handleSave() {
    startTransition(async () => {
      const result = isNew
        ? await createVisitNote({ patientId, ...form })
        : await updateVisitNote({ noteId: note!.id, patientId, ...form });

      if (result.success) {
        toast.success(isNew ? "Visit note created" : "Note saved");
        onSaved?.();
      } else {
        toast.error(result.error ?? "Failed to save note");
      }
    });
  }

  function handleSign() {
    if (!note?.id) return;
    startTransition(async () => {
      const result = await signVisitNote({ noteId: note.id, patientId });
      if (result.success) {
        toast.success("Note signed and locked");
        onSaved?.();
      } else {
        toast.error(result.error ?? "Failed to sign");
      }
    });
  }

  const isEmpty = !form.subjective && !form.objective && !form.assessment && !form.plan;

  return (
    <div className="space-y-3">
      {/* AI Draft Button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {isNew ? "New SOAP note" : `Editing note from ${format(new Date(note!.createdAt), "MMM d, yyyy")}`}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
          onClick={handleAiDraft}
          disabled={aiStreaming || isPending}
        >
          {aiStreaming ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Drafting…
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1" />
              AI Draft
            </>
          )}
        </Button>
      </div>

      {/* SOAP sections */}
      {SOAP_SECTIONS.map((section) => (
        <div key={section.key} className="space-y-1">
          <label className={`text-xs font-semibold ${section.color}`}>
            {section.label}
          </label>
          <textarea
            value={form[section.key]}
            onChange={(e) => updateField(section.key, e.target.value)}
            placeholder={section.placeholder}
            rows={3}
            className="w-full text-sm resize-y rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent placeholder:text-slate-400 leading-relaxed"
          />
        </div>
      ))}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          onClick={handleSave}
          disabled={isPending || isEmpty}
          size="sm"
          className="bg-rose-600 hover:bg-rose-700"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
          {isNew ? "Create Note" : "Save Changes"}
        </Button>

        {!isNew && note && !note.signedAt && (
          <Button
            onClick={handleSign}
            disabled={isPending || isEmpty}
            size="sm"
            variant="outline"
            className="border-green-200 text-green-700 hover:bg-green-50"
          >
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
            Sign Note
          </Button>
        )}

        {onCancel && (
          <Button onClick={onCancel} size="sm" variant="ghost" className="text-slate-500">
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function NoteCard({ note, patientId }: { note: NoteWithProvider; patientId: string }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isBlank = !note.subjective && !note.objective && !note.assessment && !note.plan;
  const hasSigned = !!note.signedAt;

  return (
    <div className={`border rounded-lg overflow-hidden ${hasSigned ? "border-green-200 bg-green-50/20" : "border-slate-200"}`}>
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => !editing && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText className={`w-3.5 h-3.5 shrink-0 ${hasSigned ? "text-green-600" : "text-slate-400"}`} />
          <span className="text-sm font-medium text-slate-800">
            {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </span>
          <span className="text-xs text-slate-400 truncate">
            — {note.provider.name} ({note.provider.role})
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasSigned ? (
            <Badge className="text-xs bg-green-100 text-green-700 border-green-200 border">
              <Lock className="w-2.5 h-2.5 mr-1" />
              Signed
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">Draft</Badge>
          )}
          {!hasSigned && !editing && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-slate-400"
              onClick={(e) => { e.stopPropagation(); setEditing(true); setExpanded(true); }}
            >
              <PenLine className="w-3.5 h-3.5" />
            </Button>
          )}
          {!editing && (
            expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-100">
          {editing ? (
            <div className="pt-3">
              <NoteEditor
                patientId={patientId}
                note={note}
                onSaved={() => setEditing(false)}
                onCancel={() => setEditing(false)}
              />
            </div>
          ) : isBlank ? (
            <p className="text-xs text-slate-400 pt-3">No content recorded.</p>
          ) : (
            <div className="space-y-3 pt-3">
              {SOAP_SECTIONS.map((s) => {
                const text = note[s.key];
                if (!text) return null;
                return (
                  <div key={s.key}>
                    <p className={`text-xs font-semibold ${s.color} mb-0.5`}>{s.label}</p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  patientId: string;
  notes: NoteWithProvider[];
}

export function VisitNoteEditor({ patientId, notes }: Props) {
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Visit Notes ({notes.length})
        </h3>
        {!showNew && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setShowNew(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Note
          </Button>
        )}
      </div>

      {showNew && (
        <Card>
          <CardContent className="p-4">
            <NoteEditor
              patientId={patientId}
              isNew
              onSaved={() => setShowNew(false)}
              onCancel={() => setShowNew(false)}
            />
          </CardContent>
        </Card>
      )}

      {notes.length === 0 && !showNew ? (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
          <FileText className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No visit notes yet.</p>
          <p className="text-xs text-slate-400 mt-0.5">Create a SOAP note after each visit.</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 text-xs h-7"
            onClick={() => setShowNew(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Note
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} patientId={patientId} />
          ))}
        </div>
      )}
    </div>
  );
}
