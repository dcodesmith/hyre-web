import { cn } from "cn";
import type { ReactNode } from "react";

interface FormErrorProps {
  readonly children?: ReactNode;
  readonly errors?: readonly string[];
  readonly id?: string;
  readonly className?: string;
}

export function FormError({ children, errors, id, className }: FormErrorProps) {
  const message = errors?.filter(Boolean).join(", ") || children;

  if (!message) {
    return null;
  }

  return (
    <p id={id} role="alert" className={cn("mt-1 text-sm text-red-500", className)}>
      {message}
    </p>
  );
}
