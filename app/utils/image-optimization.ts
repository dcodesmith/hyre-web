const ALLOWED_WIDTHS = [320, 480, 640, 800, 1024, 1200, 1600];

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
 * @param originalUrl - The original S3 image URL
 * @param options.width - Desired width (snaps to nearest allowed: 320, 480, 640, 800, 1024, 1200, 1600)
 * @param options.quality - Quality 60-90 (default: 80)
 * @param options.format - 'webp' | 'jpeg' | 'png' | 'auto' (default: 'auto')
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  options: OptimizedImageOptions = {},
): string {
  const { width, quality = 80, format = "auto" } = options;

  if (!width) return originalUrl;

  const cloudfrontDomain =
    globalThis.window !== undefined
      ? (globalThis as unknown as Window).ENV?.CLOUDFRONT_DOMAIN
      : process.env.CLOUDFRONT_DOMAIN;

  if (!cloudfrontDomain) return originalUrl;

  try {
    const url = new URL(originalUrl);
    const params = new URLSearchParams();
    params.set("w", getNearestWidth(width).toString());
    params.set("q", quality.toString());
    if (format !== "auto") {
      params.set("f", format);
    }

    return `https://${cloudfrontDomain}${url.pathname}?${params.toString()}`;
  } catch {
    return originalUrl;
  }
}

/**
 * Generate srcset for responsive images
 */
export function getImageSrcSet(
  originalUrl: string,
  baseWidth: number,
  format: ImageFormat = "auto",
): string {
  return [1, 1.5, 2]
    .map((scale) => {
      const w = getNearestWidth(Math.round(baseWidth * scale));
      return `${getOptimizedImageUrl(originalUrl, { width: w, format })} ${w}w`;
    })
    .join(", ");
}
