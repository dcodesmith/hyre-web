import type { ComponentProps, ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface AuthSubmitButtonProps {
  readonly children: ReactNode;
  readonly pending?: boolean;
  readonly pendingLabel?: string;
  readonly ariaLabel: string;
}

export function AuthSubmitButton({
  children,
  pending = false,
  pendingLabel = "Please wait",
  ariaLabel,
}: AuthSubmitButtonProps) {
  return (
    <Button
      type="submit"
      aria-label={ariaLabel}
      className="h-12 w-full rounded-md bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800"
      disabled={pending}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function AuthCheckbox({ className, ...props }: Readonly<ComponentProps<"input">>) {
  return (
    <span className="relative mt-0.5 inline-flex size-4 shrink-0">
      <input
        {...props}
        type="checkbox"
        className={cn(
          "peer size-4 appearance-none rounded-[2px] border border-neutral-400 bg-white",
          "checked:border-neutral-900 checked:bg-neutral-900",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2",
          className,
        )}
      />
      <svg
        viewBox="0 0 16 16"
        fill="none"
        className="pointer-events-none absolute inset-0 hidden size-4 text-white peer-checked:block"
        aria-hidden="true"
      >
        <path
          d="m3.25 8.25 3 3 6.5-6.5"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
