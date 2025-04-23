import { VercelRequest, VercelResponse } from "@vercel/node";
import { seed } from "prisma/seed";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    return res.status(500).json({ message: "Error seeding database", error: String(error) });
  }
}

// Configure the API route to have a larger timeout
export const config = {
  maxDuration: 300, // 5 minutes in seconds
};
