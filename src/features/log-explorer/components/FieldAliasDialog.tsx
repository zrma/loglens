import { useEffect, useMemo, useState } from "react";
import { RefreshCw, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CANONICAL_LOG_ALIAS_FIELDS,
  type CanonicalLogAliasField,
  type LogAliasPreset,
  type LogFieldAliasOverrides,
} from "@/lib/logs/aliases";

type FieldAliasDialogProps = {
  aliasOverrides: LogFieldAliasOverrides;
  disabled: boolean;
  hasSession: boolean;
  parserPreset: LogAliasPreset;
  onApplyAliasOverrides: (nextOverrides: LogFieldAliasOverrides) => void;
  onResetAliasOverrides: () => void;
};

type AliasDraft = Record<CanonicalLogAliasField, string>;

const ALIAS_FIELD_LABELS: Record<CanonicalLogAliasField, string> = {
  level: "level",
  message: "message",
  parentSpanId: "parentSpanId",
  requestId: "requestId",
  service: "service",
  spanId: "spanId",
  timestamp: "timestamp",
  traceId: "traceId",
};

function splitAliasText(value: string) {
  return [...new Set(
    value
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean),
  )];
}

function createAliasDraft(overrides: LogFieldAliasOverrides): AliasDraft {
  return Object.fromEntries(
    CANONICAL_LOG_ALIAS_FIELDS.map((field) => [field, overrides[field]?.join(", ") ?? ""]),
  ) as AliasDraft;
}

function draftToOverrides(draft: AliasDraft): LogFieldAliasOverrides {
  const nextOverrides: LogFieldAliasOverrides = {};

  for (const field of CANONICAL_LOG_ALIAS_FIELDS) {
    const aliases = splitAliasText(draft[field]);

    if (aliases.length > 0) {
      nextOverrides[field] = aliases;
    }
  }

  return nextOverrides;
}

function getAliasSignature(overrides: LogFieldAliasOverrides) {
  return JSON.stringify(
    CANONICAL_LOG_ALIAS_FIELDS.map((field) => [field, overrides[field] ?? []]),
  );
}

function countAliasOverrides(overrides: LogFieldAliasOverrides) {
  return CANONICAL_LOG_ALIAS_FIELDS.reduce((total, field) => (
    total + (overrides[field]?.length ?? 0)
  ), 0);
}

export function FieldAliasDialog({
  aliasOverrides,
  disabled,
  hasSession,
  parserPreset,
  onApplyAliasOverrides,
  onResetAliasOverrides,
}: FieldAliasDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AliasDraft>(() => createAliasDraft(aliasOverrides));

  useEffect(() => {
    setDraft(createAliasDraft(aliasOverrides));
  }, [aliasOverrides]);

  const draftOverrides = useMemo(() => draftToOverrides(draft), [draft]);
  const activeAliasCount = useMemo(() => countAliasOverrides(aliasOverrides), [aliasOverrides]);
  const draftAliasCount = useMemo(() => countAliasOverrides(draftOverrides), [draftOverrides]);
  const hasDraftChanges = getAliasSignature(draftOverrides) !== getAliasSignature(aliasOverrides);
  const hasActiveOverrides = activeAliasCount > 0;

  const updateDraftField = (field: CanonicalLogAliasField, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const applyDraft = () => {
    onApplyAliasOverrides(draftOverrides);
    setOpen(false);
  };

  const resetOverrides = () => {
    setDraft(createAliasDraft({}));
    onResetAliasOverrides();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        disabled={disabled}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold whitespace-nowrap shadow-sm transition-all outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0"
      >
        <Settings2 className="size-4 text-muted-foreground" />
        필드 매핑
        {hasActiveOverrides && (
          <span className="rounded-full border border-primary bg-accent px-2 py-0.5 text-[10px] font-bold text-primary">
            {activeAliasCount}
          </span>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[min(760px,calc(100vh-2rem))] overflow-hidden rounded-2xl border-border p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 tracking-[-0.03em]">
            <Settings2 className="size-4 text-primary" />
            필드 매핑
          </DialogTitle>
          <DialogDescription>
            현재 프리셋: {parserPreset.label}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[58vh] overflow-y-auto px-5 py-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              aliases {draftAliasCount}
            </span>
            {hasActiveOverrides && (
              <span className="rounded-full border border-primary bg-accent px-2.5 py-1 text-xs font-medium text-primary">
                custom alias active
              </span>
            )}
          </div>

          <div className="grid gap-3">
            {CANONICAL_LOG_ALIAS_FIELDS.map((field) => {
              const activeFieldAliases = aliasOverrides[field] ?? [];

              return (
                <label
                  key={field}
                  htmlFor={`alias-${field}`}
                  className="grid gap-2 rounded-xl border border-border bg-muted p-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-xs font-bold text-foreground">
                      {ALIAS_FIELD_LABELS[field]}
                    </span>
                    {activeFieldAliases.length > 0 && (
                      <span className="rounded-full border border-primary bg-accent px-2 py-0.5 text-[10px] font-bold text-primary">
                        override
                      </span>
                    )}
                  </span>
                  <Input
                    id={`alias-${field}`}
                    aria-label={`${field} alias`}
                    value={draft[field]}
                    onChange={(event) => updateDraftField(field, event.target.value)}
                    placeholder="fieldKey, shortKey"
                    disabled={disabled}
                    className="h-10 rounded-xl border-border bg-background font-mono text-sm"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={resetOverrides}
            disabled={disabled || (!hasActiveOverrides && draftAliasCount === 0)}
            className="rounded-xl"
          >
            <RotateCcw className="size-4" />
            프리셋 기준으로 되돌리기
          </Button>
          <Button
            type="button"
            onClick={applyDraft}
            disabled={disabled || !hasSession || !hasDraftChanges}
            className="rounded-xl"
          >
            <RefreshCw className="size-4" />
            현재 세션 다시 파싱
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
