const ALLOWED_WIDTHS = [320, 400, 440, 480, 640, 800, 1024, 1200, 1600];

type ImageFormat = "webp" | "jpeg" | "png" | "auto";

interface OptimizedImageOptions {
  width?: number;
  quality?: number;
  format?: ImageFormat;
}

function getNearestWidth(width: number): number {
  return ALLOWED_WIDTHS.find((w) => w >= width) || ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1];
}

/**
 * Get optimized image URL via CloudFront
 *
 * Note: This requires CloudFront with Lambda@Edge to actually process the optimization.
 * Without Lambda@Edge, CloudFront will serve the original images and ignore query parameters.
 *
 * @param originalUrl - The original S3 image URL
 * @param options.width - Desired width (snaps to nearest allowed: 320, 400, 440, 480, 640, 800, 1024, 1200, 1600)
 * @param options.quality - Quality 60-90 (default: 75 for better compression)
 * @param options.format - 'webp' | 'jpeg' | 'png' | 'auto' (default: 'auto' - uses Accept header)
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  options: OptimizedImageOptions = {},
): string {
  const { width, quality = 75, format = "auto" } = options;

  if (!width) return originalUrl;

  const cloudfrontDomain =
    globalThis.window !== undefined
      ? (globalThis as unknown as Window).ENV?.CLOUDFRONT_DOMAIN
      : process.env.CLOUDFRONT_DOMAIN;

  if (!cloudfrontDomain) return originalUrl;

  try {
    const url = new URL(originalUrl);
    // Extract pathname from S3 URL (e.g., /ownerId/carId-image.jpg)
    // CloudFront should serve from the same S3 bucket, so pathname is correct
    const s3Path = url.pathname;

    // Ensure path starts with / (it should, but be safe)
    const normalizedPath = s3Path.startsWith("/") ? s3Path : `/${s3Path}`;

    const params = new URLSearchParams();
    params.set("w", getNearestWidth(width).toString());
    params.set("q", quality.toString());
    if (format !== "auto") {
      params.set("f", format);
    }

    // Normalize CloudFront domain (remove protocol if present)
    const normalizedDomain = cloudfrontDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");

    return `https://${normalizedDomain}${normalizedPath}?${params.toString()}`;
  } catch (error) {
    // In development, log the error for debugging
    if (process.env.NODE_ENV === "development") {
      console.warn("Image optimization URL construction failed:", error, { originalUrl, options });
    }
    return originalUrl;
  }
}

/**
 * Generate srcset for responsive images
 * Includes granular sizes for better mobile optimization
 */
export function getImageSrcSet(
  originalUrl: string,
  baseWidth: number,
  format: ImageFormat = "auto",
): string {
  // For mobile (baseWidth <= 480), include granular sizes up to 2x DPI
  // Most mobile devices are 2x, so we don't need 3x scale (saves bandwidth)
  // For desktop, standard 1x, 1.5x, 2x is sufficient
  const scales =
    baseWidth <= 480
      ? [1, 1.5, 2, 2.5] // Mobile: covers 1x, 1.5x, 2x, 2.5x DPI (max 800w for 320px base)
      : [1, 1.5, 2]; // Desktop: standard scales

  const uniqueWidths = new Set<number>();

  return scales
    .map((scale) => {
      const w = getNearestWidth(Math.round(baseWidth * scale));
      return `${getOptimizedImageUrl(originalUrl, { width: w, format })} ${w}w`;
    })
    .filter((entry) => {
      const w = Number.parseInt(entry.split(" ")[1], 10);
      if (uniqueWidths.has(w)) return false;
      uniqueWidths.add(w);
      return true;
    })
    .join(", ");
}
