import { useEffect, useState } from "react";

const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isReviewEditable(createdAt: string, now: string) {
  const createdAtMs = Date.parse(createdAt);
  const nowMs = Date.parse(now);

  return (
    Number.isFinite(createdAtMs) && Number.isFinite(nowMs) && createdAtMs >= nowMs - EDIT_WINDOW_MS
  );
}

export function useReviewEditWindow(createdAt: string, now: string) {
  const [isEditable, setIsEditable] = useState(() => isReviewEditable(createdAt, now));

  useEffect(() => {
    const createdAtMs = Date.parse(createdAt);
    const nowMs = Date.parse(now);
    const editable = isReviewEditable(createdAt, now);

    setIsEditable(editable);
    if (!editable) {
      return;
    }

    const timer = window.setTimeout(
      () => setIsEditable(false),
      createdAtMs + EDIT_WINDOW_MS - nowMs,
    );

    return () => window.clearTimeout(timer);
  }, [createdAt, now]);

  return isEditable;
}
