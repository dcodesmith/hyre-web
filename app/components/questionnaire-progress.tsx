import { CheckIcon, CircleIcon } from "lucide-react";

import { cn } from "~/lib/utils";

export type QuestionnaireStage = {
  readonly complete: boolean;
  readonly key: string;
  readonly label: string;
};

type QuestionnaireProgressProps = {
  readonly ariaLabel: string;
  readonly currentStage: string | null;
  readonly stages: readonly QuestionnaireStage[];
};

export function QuestionnaireProgress({
  ariaLabel,
  currentStage,
  stages,
}: QuestionnaireProgressProps) {
  return (
    <ol
      aria-label={ariaLabel}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
    >
      {stages.map((stage) => {
        const current = stage.key === currentStage;

        return (
          <li
            key={stage.key}
            aria-current={current ? "step" : undefined}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1.5 border-t-2 pt-2 text-center text-xs",
              stage.complete || current
                ? "border-primary text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full",
                stage.complete
                  ? "bg-primary text-primary-foreground"
                  : current
                    ? "border border-primary"
                    : "border border-border",
              )}
            >
              {stage.complete ? (
                <CheckIcon className="size-3.5" aria-hidden="true" />
              ) : (
                <CircleIcon className="size-2 fill-current" aria-hidden="true" />
              )}
            </span>
            <span className="truncate">
              {stage.label}
              <span className="sr-only">
                , {stage.complete ? "completed" : current ? "current" : "upcoming"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
