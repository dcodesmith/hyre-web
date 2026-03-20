interface BrandLogoProps {
  readonly iconContainerClassName?: string;
  readonly textClassName?: string;
}

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function BrandLogo({ iconContainerClassName, textClassName }: BrandLogoProps) {
  return (
    <>
      <div
        className={mergeClassNames(
          "flex h-10 w-10 items-center justify-center rounded-xl border border-[#B8922A] bg-white",
          iconContainerClassName,
        )}
      >
        <svg className="h-5 w-5 fill-[#B8922A]" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.08 3.11H5.77L6.85 7zM19 17H5v-5h14v5zm-2.5-1c.83 0 1.5-.67 1.5-1.5S17.33 13 16.5 13s-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm-9 0c.83 0 1.5-.67 1.5-1.5S8.33 13 7.5 13 6 13.67 6 14.5 6.67 16 7.5 16z" />
        </svg>
      </div>
      <span
        className={mergeClassNames(
          "text-2xl font-medium tracking-wide text-[#1A1814]",
          textClassName,
        )}
      >
        Tripdly
      </span>
    </>
  );
}
