interface XIconProps {
  readonly size?: number;
  readonly className?: string;
  /** When true (default), the SVG is decorative; the parent link should set the accessible name. */
  readonly decorative?: boolean;
}

export function XIcon({ size = 20, className = "", decorative = true }: XIconProps) {
  return (
    <svg
      aria-hidden={decorative ? true : undefined}
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
      <title>X</title>
      <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
      <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
    </svg>
  );
}
