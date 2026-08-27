import { useEffect, useRef, useState } from "react";

export type CopiedTarget = "code" | "link";

export function useCopyFeedback() {
  const resetTimer = useRef<number | undefined>(undefined);
  const [copiedTarget, setCopiedTarget] = useState<CopiedTarget | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copyToClipboard(value: string, target: CopiedTarget) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError(null);
      setCopiedTarget(target);
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      setCopyError("Unable to copy. Please select and copy it manually.");
    }
  }

  return { copiedTarget, copyError, copyToClipboard };
}
