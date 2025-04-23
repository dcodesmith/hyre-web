import type { VercelRequest, VercelResponse } from "@vercel/node";
import { seed } from "../prisma/seed";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
  );

  // Handle OPTIONS request for CORS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Verify authorization
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.SEED_SECRET_TOKEN;

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await seed();
    return res.status(200).json({ message: "Database seeded successfully" });
  } catch (error) {
    console.error("Seeding error:", error);
    return res.status(500).json({
      message: "Error seeding database",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const config = {
  maxDuration: 300, // 5 minutes in seconds
};
