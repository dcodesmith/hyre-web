interface SocialIconProps {
  readonly className?: string;
}

const sharedProps = {
  "aria-hidden": true,
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 2,
  viewBox: "0 0 24 24",
} as const;

export function FacebookIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} {...sharedProps}>
      <title>Facebook</title>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export function InstagramIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} {...sharedProps}>
      <title>Instagram</title>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function XIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} {...sharedProps}>
      <title>X</title>
      <path d="M4 4l11.733 16H20L8.267 4z" />
      <path d="m4 20 6.768-6.768m2.46-2.46L20 4" />
    </svg>
  );
}
