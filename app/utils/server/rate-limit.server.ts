import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import logger from "~/lib/logger.server";
import { env } from "~/utils/server/env.server";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN,
});

const aiSearchByIpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(8, "60 s", 12),
  analytics: true,
  prefix: "rl:ai-search:ip",
});

const aiSearchByUserLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(60, "1 h", 80),
  analytics: true,
  prefix: "rl:ai-search:user",
});

const referralValidationByIpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 h"),
  analytics: true,
  prefix: "rl:referral-validate:ip",
});

const tripDurationByIpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "10 m"),
  analytics: true,
  prefix: "rl:trip-duration:ip",
});

const searchFlightByIpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(40, "10 m"),
  analytics: true,
  prefix: "rl:search-flight:ip",
});

const otpByIpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "10 m"),
  analytics: true,
  prefix: "rl:otp:ip",
});

const OTP_FAILURE_WINDOW_SECONDS = 15 * 60;
const OTP_LOCKOUT_THRESHOLD = 12;
const OTP_PROGRESSIVE_DELAY_START = 6;

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending?: Promise<unknown>;
};

type ClientIdentity = {
  ipAddress: string;
  forwardedFor?: string;
};

type LimiterFailureMode = "fail-open" | "fail-closed";

function firstValue(value: string | null) {
  if (!value) return "";
  return value.split(",")[0]?.trim() ?? "";
}

export function getClientIdentity(request: Request): ClientIdentity {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress =
    firstValue(forwardedFor) ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  return {
    ipAddress,
    forwardedFor: forwardedFor ?? undefined,
  };
}

function toRetryAfterSeconds(reset: number) {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

function resolveLimiterFailureMode(): LimiterFailureMode {
  const failOpenOverride = process.env.RATE_LIMIT_FAIL_OPEN;
  if (failOpenOverride === "true") return "fail-open";
  if (failOpenOverride === "false") return "fail-closed";
  return env.NODE_ENV === "production" ? "fail-closed" : "fail-open";
}

function createLimiterUnavailableHeaders(): HeadersInit {
  return {
    "Retry-After": "1",
    "Cache-Control": "no-store",
  };
}

function reportLimiterUnavailable(args: {
  logPrefix: string;
  failureMode: LimiterFailureMode;
  error: unknown;
}) {
  const { logPrefix, failureMode, error } = args;
  const details = error instanceof Error ? { name: error.name, message: error.message } : { error };

  logger.error("[METRIC] rate_limiter_unavailable", {
    ...details,
    source: logPrefix,
    failureMode,
  });
  logger.warn(`${logPrefix} limiter unavailable, switched to ${failureMode}`, {
    ...details,
    failureMode,
  });
}

export function createRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "Retry-After": toRetryAfterSeconds(result.reset).toString(),
    "RateLimit-Limit": result.limit.toString(),
    "RateLimit-Remaining": Math.max(0, result.remaining).toString(),
    "RateLimit-Reset": toRetryAfterSeconds(result.reset).toString(),
    "Cache-Control": "no-store",
  };
}

export function isTooManyAttemptsError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("too many attempts") || message.includes("maximum attempts");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeUserId(userId: string) {
  return userId.trim().toLowerCase();
}

function cooldownKey(key: string) {
  return `rl:otp:cooldown:${key}`;
}

function lockoutKey(key: string) {
  return `rl:otp:lockout:${key}`;
}

function failureKey(key: string) {
  return `rl:otp:failure:${key}`;
}

function hashIdentifierForLogs(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function getTtlSeconds(key: string) {
  try {
    const ttl = await redis.ttl(key);
    if (ttl < 0) return 0;
    return ttl;
  } catch (error) {
    logger.warn("[RATE_LIMIT] failed to read TTL", { keyHash: hashIdentifierForLogs(key), error });
    return 0;
  }
}

async function setCooldown(key: string, seconds: number) {
  if (seconds <= 0) return;
  try {
    await redis.set(cooldownKey(key), "1", { ex: seconds });
  } catch (error) {
    logger.warn("[RATE_LIMIT] failed to set cooldown", {
      keyHash: hashIdentifierForLogs(key),
      seconds,
      error,
    });
  }
}

async function lockoutAccount(key: string) {
  try {
    await redis.set(lockoutKey(key), "1", { ex: 15 * 60 });
  } catch (error) {
    logger.warn("[RATE_LIMIT] failed to set account lockout", {
      keyHash: hashIdentifierForLogs(key),
      error,
    });
  }
}

async function ensureFailureKeyTtl(key: string) {
  try {
    const ttl = await redis.ttl(key);
    if (ttl <= 0) {
      await redis.expire(key, OTP_FAILURE_WINDOW_SECONDS);
    }
  } catch (error) {
    logger.warn("[RATE_LIMIT] failed to ensure OTP failure TTL", {
      keyHash: hashIdentifierForLogs(key),
      error,
    });
  }
}

function otpSubjectKey(email: string, ipAddress: string) {
  return `${normalizeEmail(email)}:${ipAddress}`;
}

async function limitByIp(args: {
  request: Request;
  limiter: Ratelimit;
  logPrefix: string;
  message: string;
}) {
  const { request, limiter, logPrefix, message } = args;
  const { ipAddress } = getClientIdentity(request);
  let result: RateLimitResult;
  try {
    result = await limiter.limit(ipAddress);
  } catch (error) {
    const failureMode = resolveLimiterFailureMode();
    reportLimiterUnavailable({ logPrefix, failureMode, error });

    if (failureMode === "fail-open") {
      return {
        allowed: true as const,
      };
    }

    return {
      allowed: false as const,
      status: 503 as const,
      headers: createLimiterUnavailableHeaders(),
      message: "Rate limiting is temporarily unavailable. Please try again shortly.",
      reason: "limiter_unavailable" as const,
    };
  }

  const pending = result.pending;
  if (pending !== undefined) {
    pending.catch((error) => {
      logger.warn(`${logPrefix} pending write failed`, { error });
    });
  }

  if (!result.success) {
    return {
      allowed: false as const,
      headers: createRateLimitHeaders(result),
      message,
    };
  }

  return {
    allowed: true as const,
  };
}

export async function checkAiSearchRateLimit(args: {
  request: Request;
  userId?: string | null;
}) {
  const { request, userId } = args;
  const { ipAddress } = getClientIdentity(request);

  let ipResult: RateLimitResult;
  let userResult: RateLimitResult | null;
  try {
    [ipResult, userResult] = await Promise.all([
      aiSearchByIpLimiter.limit(ipAddress),
      userId ? aiSearchByUserLimiter.limit(normalizeUserId(userId)) : Promise.resolve(null),
    ]);
  } catch (error) {
    const failureMode = resolveLimiterFailureMode();
    reportLimiterUnavailable({
      logPrefix: "[RATE_LIMIT] ai-search",
      failureMode,
      error,
    });

    if (failureMode === "fail-open") {
      return {
        allowed: true as const,
      };
    }

    return {
      allowed: false as const,
      reason: "limiter_unavailable" as const,
      status: 503 as const,
      headers: createLimiterUnavailableHeaders(),
    };
  }

  const ipPending = ipResult.pending;
  if (ipPending !== undefined) {
    ipPending.catch((error) => {
      logger.warn("[RATE_LIMIT] ai-search ip pending write failed", { error });
    });
  }

  const userPending = userResult?.pending;
  if (userPending !== undefined) {
    userPending.catch((error) => {
      logger.warn("[RATE_LIMIT] ai-search user pending write failed", { error });
    });
  }

  if (!ipResult.success) {
    return {
      allowed: false as const,
      reason: "ip",
      headers: createRateLimitHeaders(ipResult),
    };
  }

  if (userResult && !userResult.success) {
    return {
      allowed: false as const,
      reason: "user",
      headers: createRateLimitHeaders(userResult),
    };
  }

  return {
    allowed: true as const,
  };
}

export async function checkReferralValidationRateLimit(request: Request) {
  return limitByIp({
    request,
    limiter: referralValidationByIpLimiter,
    logPrefix: "[RATE_LIMIT] referral-validation",
    message: "Too many validation attempts. Please try again later.",
  });
}

export async function checkTripDurationRateLimit(request: Request) {
  return limitByIp({
    request,
    limiter: tripDurationByIpLimiter,
    logPrefix: "[RATE_LIMIT] trip-duration",
    message: "Too many requests. Please try again in a few minutes.",
  });
}

export async function checkSearchFlightRateLimit(request: Request) {
  return limitByIp({
    request,
    limiter: searchFlightByIpLimiter,
    logPrefix: "[RATE_LIMIT] search-flight",
    message: "Too many requests. Please try again in a few minutes.",
  });
}

export async function checkOtpVerificationGuard(args: {
  request: Request;
  email: string;
}) {
  const { request, email } = args;
  const { ipAddress } = getClientIdentity(request);
  const accountKey = normalizeEmail(email);
  const subjectKey = otpSubjectKey(email, ipAddress);

  let cooldownTtl = 0;
  let lockoutTtl = 0;
  try {
    [cooldownTtl, lockoutTtl] = await Promise.all([
      getTtlSeconds(cooldownKey(subjectKey)),
      getTtlSeconds(lockoutKey(accountKey)),
    ]);
  } catch (error) {
    logger.warn("[RATE_LIMIT] otp TTL check failed, allowing request", { error });
    return {
      allowed: true as const,
      subjectKey,
      accountKey,
    };
  }

  if (lockoutTtl > 0) {
    return {
      allowed: false as const,
      retryAfterSeconds: lockoutTtl,
      headers: {
        "Retry-After": lockoutTtl.toString(),
        "Cache-Control": "no-store",
      } as HeadersInit,
      message: "Too many failed attempts. Please request a new code and try again later.",
    };
  }

  if (cooldownTtl > 0) {
    return {
      allowed: false as const,
      retryAfterSeconds: cooldownTtl,
      headers: {
        "Retry-After": cooldownTtl.toString(),
        "Cache-Control": "no-store",
      } as HeadersInit,
      message: "Please wait before trying another code.",
    };
  }

  let ipResult: RateLimitResult;
  try {
    ipResult = await otpByIpLimiter.limit(ipAddress);
  } catch (error) {
    const failureMode = resolveLimiterFailureMode();
    reportLimiterUnavailable({
      logPrefix: "[RATE_LIMIT] otp IP",
      failureMode,
      error,
    });

    if (failureMode === "fail-open") {
      return {
        allowed: true as const,
        subjectKey,
        accountKey,
      };
    }

    return {
      allowed: false as const,
      retryAfterSeconds: 1,
      headers: createLimiterUnavailableHeaders(),
      message: "Verification is temporarily unavailable. Please try again shortly.",
      status: 503 as const,
    };
  }

  const otpIpPending = ipResult.pending;
  if (otpIpPending !== undefined) {
    otpIpPending.catch((error) => {
      logger.warn("[RATE_LIMIT] otp ip pending write failed", { error });
    });
  }

  if (!ipResult.success) {
    const retryAfterSeconds = toRetryAfterSeconds(ipResult.reset);
    return {
      allowed: false as const,
      retryAfterSeconds,
      headers: createRateLimitHeaders(ipResult),
      message: "Too many verification attempts from this network. Please try again later.",
    };
  }

  return {
    allowed: true as const,
    subjectKey,
    accountKey,
  };
}

export async function recordOtpFailure(args: {
  accountKey: string;
  subjectKey: string;
}) {
  const { accountKey, subjectKey } = args;
  const subjectFailureKey = failureKey(subjectKey);
  const accountFailureKey = failureKey(accountKey);

  try {
    const [, accountCount] = await Promise.all([
      redis.incr(subjectFailureKey),
      redis.incr(accountFailureKey),
    ]);

    await Promise.all([ensureFailureKeyTtl(subjectFailureKey), ensureFailureKeyTtl(accountFailureKey)]);

    if (accountCount >= OTP_PROGRESSIVE_DELAY_START) {
      const delayExponent = Math.max(0, accountCount - OTP_PROGRESSIVE_DELAY_START);
      const delaySeconds = Math.min(30, 2 ** Math.min(4, delayExponent));
      await setCooldown(subjectKey, delaySeconds);
    }

    if (accountCount >= OTP_LOCKOUT_THRESHOLD) {
      await lockoutAccount(accountKey);
    }
  } catch (error) {
    logger.warn("[RATE_LIMIT] failed to record OTP failure", {
      accountKeyHash: hashIdentifierForLogs(accountKey),
      subjectKeyHash: hashIdentifierForLogs(subjectKey),
      error,
    });
  }
}

export async function clearOtpFailures(args: {
  accountKey: string;
  subjectKey: string;
}) {
  const { accountKey, subjectKey } = args;
  try {
    await redis.del(
      failureKey(subjectKey),
      failureKey(accountKey),
      cooldownKey(subjectKey),
      lockoutKey(accountKey),
    );
  } catch (error) {
    logger.warn("[RATE_LIMIT] failed to clear OTP failure state", {
      accountKeyHash: hashIdentifierForLogs(accountKey),
      subjectKeyHash: hashIdentifierForLogs(subjectKey),
      error,
    });
  }
}
