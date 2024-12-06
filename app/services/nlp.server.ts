// import { OpenAI } from "openai";
// import { prisma } from "~/modules/db/db.server";

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// type QueryResult = {
//   sql: string;
//   prismaQuery: string | null;
//   error?: string;
//   result?: unknown;
// };

// export async function naturalLanguageToQuery(
//   userInput: string
// ): Promise<QueryResult> {
//   try {
//     const completion = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: `You are a SQL query generator. Convert natural language to Prisma queries for a car booking system.
//             Available models and fields:
//             Car (id, make, model, year, color, price, status, ownerId)
//             Booking (id, status, startDate, endDate, totalAmount, paymentStatus, carId, userId, pickupLocation, returnLocation)
//             User (id, email, username)

//             Respond ONLY with the Prisma query, no additional text or explanations.
//             Example format: Car.findMany({ where: { status: 'available' } })`,
//         },
//         {
//           role: "user",
//           content: userInput,
//         },
//       ],
//       temperature: 0,
//     });

//     const prismaQuery = completion.choices[0].message.content?.trim();
//     if (!prismaQuery) {
//       throw new Error("No query generated");
//     }

//     // Instead of eval, use a safer approach to execute the query
//     // Parse the model name from the response
//     const modelName = prismaQuery.split(".")[0].toLowerCase();
//     if (!["car", "booking", "user"].includes(modelName)) {
//       throw new Error("Invalid model name");
//     }

//     console.log(
//       prisma[modelName as keyof typeof prisma][prismaQuery.split(".")[1]]
//     );

//     // Execute the query using the parsed model name
//     const result = await prisma[modelName as keyof typeof prisma][
//       prismaQuery.split(".")[1]
//     ](
//       JSON.parse(
//         prismaQuery.substring(
//           prismaQuery.indexOf("(") + 1,
//           prismaQuery.lastIndexOf(")")
//         )
//       )
//     );

//     return {
//       sql: await prisma.$queryRaw`${prismaQuery}`,
//       prismaQuery,
//       result,
//     };
//   } catch (error) {
//     console.error(error);
//     return {
//       sql: "",
//       prismaQuery: null,
//       error: error.message,
//     };
//   }
// }
