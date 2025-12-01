interface NairaIconProps {
  readonly size?: number;
  readonly className?: string;
}

export function NairaIcon({ size = 18, className = "" }: NairaIconProps) {
  return (
    <svg
      aria-label="Naira Icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Naira Icon</title>
      {/* Naira symbol (₦) - stylized N with double horizontal lines */}
      <path d="M6 4v16" />
      <path d="M18 4v16" />
      <path d="M6 4l12 16" />
      <path d="M3 10h18" />
      <path d="M3 14h18" />
    </svg>
  );
}
