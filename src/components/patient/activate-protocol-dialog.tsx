"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { activateProtocol } from "@/app/actions/protocol-actions";
import {
  PROTOCOL_TYPES,
  PROTOCOL_LABELS,
  PROTOCOL_DESCRIPTIONS,
  PROTOCOL_TASKS,
  type ProtocolType,
} from "@/lib/protocols";
import { Plus, CheckCircle, ClipboardList } from "lucide-react";

interface Props {
  patientId: string;
  activeProtocolTypes: string[];
}

export function ActivateProtocolDialog({ patientId, activeProtocolTypes }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProtocolType | null>(null);
  const [isPending, startTransition] = useTransition();

  const available = PROTOCOL_TYPES.filter(
    (p) => !activeProtocolTypes.includes(p),
  );

  function handleActivate() {
    if (!selected) return;
    startTransition(async () => {
      const result = await activateProtocol({ patientId, protocolType: selected });
      if (result.success) {
        toast.success(`${PROTOCOL_LABELS[selected]} activated`);
        setOpen(false);
        setSelected(null);
      } else {
        toast.error(result.error ?? "Failed to activate protocol");
      }
    });
  }

  if (available.length === 0) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-xs border-violet-200 text-violet-700 hover:bg-violet-50"
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add Protocol
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Activate Care Protocol</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {available.map((type) => {
              const taskCount = PROTOCOL_TASKS[type]?.length ?? 0;
              const isSelected = selected === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelected(type)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-violet-400 bg-violet-50"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">
                          {PROTOCOL_LABELS[type]}
                        </p>
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-violet-600" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {PROTOCOL_DESCRIPTIONS[type]}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      <ClipboardList className="w-3 h-3 mr-1" />
                      {taskCount} tasks
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="border border-violet-100 rounded-lg bg-violet-50 p-3 text-xs text-slate-600">
              <p className="font-medium text-violet-700 mb-1.5">
                Tasks that will be created:
              </p>
              <ul className="space-y-1">
                {PROTOCOL_TASKS[selected].map((t) => (
                  <li key={t.title} className="flex items-start gap-1.5">
                    <span className="mt-0.5 w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                    <span>{t.title}</span>
                    <span className="text-slate-400 ml-auto shrink-0">
                      in {t.daysFromNow}d
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleActivate}
              disabled={!selected || isPending}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {isPending ? "Activating…" : "Activate Protocol"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
