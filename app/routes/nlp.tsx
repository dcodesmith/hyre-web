// import type { ActionFunctionArgs } from "@remix-run/node";
// import { json } from "@remix-run/node";
// import { Form, useActionData } from "@remix-run/react";
// import { langchain } from "~/services/langchain.server";

// export async function action({ request }: ActionFunctionArgs) {
//   const formData = await request.formData();
//   const query = String(formData.get("query"));

//   if (!query) {
//     return json({ error: "Query is required" });
//   }

//   const result = await langchain(query);

//   //   const result = await naturalLanguageToQuery(query);
//   return json({ result });
// }

// // export async function loader() {
// //   await langchain();

// //   return null;
// // }

// export default function NLPQuery() {
//   const actionData = useActionData<typeof action>();

//   return (
//     <div className="p-6">
//       <h1 className="text-2xl font-bold mb-4">Natural Language Query</h1>

//       <Form method="post" className="space-y-4">
//         <div>
//           <label
//             htmlFor="query"
//             className="block text-sm font-medium text-gray-700"
//           >
//             Ask a question about cars or bookings
//           </label>
//           <textarea
//             id="query"
//             name="query"
//             rows={3}
//             className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
//             placeholder="e.g., Show me all available cars for tomorrow"
//           />
//         </div>

//         <button
//           type="submit"
//           className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
//         >
//           Search
//         </button>
//       </Form>

//       {actionData?.error ? (
//         <div className="mt-4 text-red-600">{actionData.error}</div>
//       ) : actionData?.result ? (
//         <div className="mt-4">
//           <h2 className="text-lg font-semibold mb-2">Results:</h2>
//           <pre className="bg-gray-100 p-4 rounded-md overflow-auto">
//             {JSON.stringify(actionData.result, null, 2)}
//           </pre>
//         </div>
//       ) : null}
//     </div>
//   );
// }
