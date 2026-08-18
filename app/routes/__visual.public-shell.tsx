export default function PublicShellFixture() {
  return (
    <section
      aria-labelledby="shell-fixture-title"
      className="flex min-h-[560px] items-center justify-center bg-white px-6 py-16"
    >
      <div className="flex max-w-xl flex-col items-center gap-4 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Visual regression fixture
        </p>
        <h1 id="shell-fixture-title" className="text-4xl font-semibold tracking-tight">
          Public shell content
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          This deterministic route isolates the shared header, footer, mobile navigation, cookie
          banner, typography, and responsive spacing from product data.
        </p>
      </div>
    </section>
  );
}
