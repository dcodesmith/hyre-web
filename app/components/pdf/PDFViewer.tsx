import { Suspense, lazy, useMemo } from "react";

// Serve the PDF.js worker from the public folder to avoid CSP/CORS issues
const workerSrc = "/pdf.worker.min.js";

interface PDFViewerProps {
  readonly fileUrl: string;
}

const LazyPdf = lazy(async () => {
  const [{ Worker, Viewer }, layoutModule] = await Promise.all([
    import("@react-pdf-viewer/core"),
    import("@react-pdf-viewer/default-layout"),
    import("@react-pdf-viewer/core/lib/styles/index.css"),
    import("@react-pdf-viewer/default-layout/lib/styles/index.css"),
  ]);

  const { defaultLayoutPlugin } = layoutModule;

  const Component = ({ fileUrl }: PDFViewerProps) => {
    const defaultLayoutPluginInstance = useMemo(() => defaultLayoutPlugin(), []);

    return (
      <Worker workerUrl={workerSrc}>
        <div className="h-full">
          <Viewer fileUrl={fileUrl} plugins={[defaultLayoutPluginInstance]} defaultScale={1} />
        </div>
      </Worker>
    );
  };

  return { default: Component };
});

export function PDFViewer({ fileUrl }: PDFViewerProps) {
  return (
    <Suspense
      fallback={
        <output
          className="flex h-full items-center justify-center text-sm text-gray-500"
          aria-live="polite"
        >
          Loading PDF…
        </output>
      }
    >
      <LazyPdf fileUrl={fileUrl} />
    </Suspense>
  );
}
