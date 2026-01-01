import { type ActionFunctionArgs } from "@remix-run/node";
import { add } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import OpenAI from "openai";
import logger from "~/lib/logger.server";
import { extractedParamsSchema } from "~/schemas/ai.search.schema";
import { env } from "~/utils/server/env.server";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

interface ExtractedParams {
  color?: string;
  make?: string;
  model?: string;
  vehicleType?: "SEDAN" | "SUV" | "LUXURY_SEDAN" | "LUXURY_SUV" | "VAN" | "CROSSOVER";
  serviceTier?: "STANDARD" | "EXECUTIVE" | "LUXURY" | "ULTRA_LUXURY";
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  bookingType?: "DAY" | "NIGHT" | "FULL_DAY" | "AIRPORT_PICKUP";
  pickupTime?: string; // "10 AM", "2 PM"
  flightNumber?: string;
}

/**
 * Converts extracted parameters to URL search params
 */
function buildSearchParams(params: ExtractedParams): Record<string, string> {
  const searchParams: Record<string, string> = {};

  if (params.color) searchParams.color = params.color;
  if (params.make) searchParams.make = params.make;
  if (params.model) searchParams.model = params.model;
  if (params.vehicleType) searchParams.vehicleType = params.vehicleType;
  if (params.serviceTier) searchParams.serviceTier = params.serviceTier;
  if (params.from) searchParams.from = params.from;
  if (params.to) searchParams.to = params.to;
  if (params.bookingType) searchParams.bookingType = params.bookingType;
  if (params.pickupTime) searchParams.pickupTime = params.pickupTime;
  if (params.flightNumber) searchParams.flightNumber = params.flightNumber;

  return searchParams;
}

/**
 * Generates a human-readable interpretation of what the AI understood
 */
function generateInterpretation(params: ExtractedParams): string {
  const parts: string[] = [];

  if (params.color || params.make || params.vehicleType || params.serviceTier || params.model) {
    const vehicle = [
      params.color,
      params.make,
      params.model,
      params.serviceTier?.toLowerCase(),
      params.vehicleType?.toLowerCase().replace("_", " "),
    ]
      .filter(Boolean)
      .join(" ");
    parts.push(`Looking for: ${vehicle}`);
  }

  if (params.from && params.to) {
    parts.push(`Dates: ${params.from} to ${params.to}`);
  } else if (params.from) {
    parts.push(`Starting: ${params.from}`);
  }

  if (params.bookingType) {
    const typeLabels = {
      DAY: "day rental",
      NIGHT: "night service",
      FULL_DAY: "full day (24hr)",
      AIRPORT_PICKUP: "airport pickup",
    };
    parts.push(`Type: ${typeLabels[params.bookingType]}`);
  }

  return parts.join(" • ");
}

/**
 * Uses OpenAI to extract search parameters from natural language
 */
async function extractWithAI(query: string): Promise<ExtractedParams> {
  const today = formatInTimeZone(new Date(), LAGOS_TIMEZONE, "yyyy-MM-dd");
  const todayDate = new Date();

  const systemPrompt = `You are a car rental search assistant for Tripdly in Lagos, Nigeria.
Extract search parameters from user queries and return them as JSON.

Today's date is: ${today} (${todayDate.toDateString()})
Timezone: Africa/Lagos (WAT)

Extract the following fields when mentioned:
- color: Vehicle color (e.g., "black", "white", "silver", "blue", "red")
- make: Car brand (e.g., "Toyota", "Mercedes", "BMW", "Lexus")
- model: Car model (e.g., "Camry", "E-Class", "X5")
- vehicleType: One of: SEDAN, SUV, LUXURY_SEDAN, LUXURY_SUV, VAN, CROSSOVER
- serviceTier: One of: STANDARD, EXECUTIVE, LUXURY, ULTRA_LUXURY
- from: Start date in YYYY-MM-DD format
- to: End date in YYYY-MM-DD format
- bookingType: One of: DAY, NIGHT, FULL_DAY, AIRPORT_PICKUP
- pickupTime: Time in "HH AM/PM" format (e.g., "10 AM", "2 PM")
- flightNumber: Flight number for airport pickups

Date parsing rules:
- "today" = ${today}
- "tomorrow" = ${formatInTimeZone(add(todayDate, { days: 1 }), LAGOS_TIMEZONE, "yyyy-MM-dd")}
- "next Monday/Tuesday/etc" = calculate the next occurrence
- "X days" = duration from start date
- "X nights" = duration + set bookingType to NIGHT

Vehicle type mapping:
- "sedan", "car", "saloon" → SEDAN
- "suv", "jeep" → SUV
- "luxury sedan", "premium sedan" → LUXURY_SEDAN
- "luxury suv", "premium suv" → LUXURY_SUV
- "van", "bus", "minibus" → VAN
- "crossover" → CROSSOVER

Service tier mapping:
- "standard", "budget", "cheap", "affordable" → STANDARD
- "executive", "business" → EXECUTIVE
- "luxury", "premium" → LUXURY
- "ultra luxury", "ultra-luxury", "high-end" → ULTRA_LUXURY

Booking type mapping:
- Default to DAY if dates are mentioned without specifying night/airport
- "night", "overnight" → NIGHT
- "24 hours", "full day", "24hr" → FULL_DAY
- "airport", "flight", "pickup" → AIRPORT_PICKUP

Important:
- Only include fields that are explicitly mentioned or can be inferred
- If duration is mentioned (e.g., "5 days"), calculate the end date
- Be flexible with synonyms (e.g., "Benz" = "Mercedes")
- Return valid JSON only`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
    response_format: { type: "json_object" },
    temperature: 0, // Deterministic output
    max_tokens: 300,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    logger.error("[AI_SEARCH] Failed to parse AI response", { content, error });
    throw new Error("Invalid response format from AI");
  }

  const validationResult = extractedParamsSchema.safeParse(parsed);
  if (!validationResult.success) {
    logger.error("[AI_SEARCH] Validation failed", {
      content,
      errors: validationResult.error.issues,
    });
    throw new Error("AI returned invalid parameters");
  }

  const extracted = validationResult.data;

  logger.info("[AI_SEARCH] Extracted parameters", {
    query,
    extracted,
    tokensUsed: completion.usage?.total_tokens,
  });

  return extracted;
}

/**
 * POST /api/ai-search
 * Accepts natural language query and returns structured search parameters
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string") {
      return Response.json({ error: "Query is required" }, { status: 400 });
    }

    // Extract parameters using AI
    const extracted = await extractWithAI(query.trim());

    // Build search URL parameters
    const params = buildSearchParams(extracted);

    // Generate human-readable interpretation
    const interpretation = generateInterpretation(extracted);

    logger.info("[AI_SEARCH] Search successful", {
      query,
      params,
      interpretation,
    });

    return Response.json(
      {
        params,
        interpretation,
        raw: extracted, // Include raw extraction for debugging
      },
      {
        headers: {
          "Cache-Control": "no-store", // Don't cache AI responses
        },
      },
    );
  } catch (error) {
    logger.error("[AI_SEARCH] Error processing query", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process search. Please try again.",
      },
      { status: 500 },
    );
  }
}
