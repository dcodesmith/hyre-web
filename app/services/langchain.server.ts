// import { createReactAgent } from "@langchain/langgraph/prebuilt";
// import { ChatOpenAI } from "@langchain/openai";
// import { SqlToolkit } from "langchain/agents/toolkits/sql";
// import { SqlDatabase } from "langchain/sql_db";
// import { DataSource } from "typeorm";

// // import { createSqlAgent } from "langchain/agents/sql";

// // const llm = new ChatOpenAI({
// //   model: "gpt-4o-mini",
// //   temperature: 0,
// // });

// // const datasource = new DataSource({
// //   type: "postgres",
// //   database: process.env.DATABASE_URL,
// // });
// // const db = await SqlDatabase.fromDataSourceParams({
// //   appDataSource: datasource,
// // });

// // const toolkit = new SqlToolkit(db, llm);

// // const tools = toolkit.getTools();

// // const agentExecutor = createReactAgent({ llm, tools });

// // const exampleQuery = "Can you list 10 artists from my database?";

// // const events = await agentExecutor.stream(
// //   { messages: [["user", exampleQuery]] },
// //   { streamMode: "values" }
// // );

// // for await (const event of events) {
// //   const lastMsg = event.messages[event.messages.length - 1];
// //   if (lastMsg.tool_calls?.length) {
// //     console.dir(lastMsg.tool_calls, { depth: null });
// //   } else if (lastMsg.content) {
// //     console.log(lastMsg.content);
// //   }
// // }

// // console.log(
// //   tools.map((tool) => ({
// //     name: tool.name,
// //     description: tool.description,
// //   }))
// // );

// export async function langchain(query: string) {
//   const llm = new ChatOpenAI({
//     model: "gpt-4o-mini",
//     temperature: 0,
//   });

//   const datasource = new DataSource({
//     type: "postgres",
//     url: process.env.DATABASE_URL,
//   });

//   try {
//     // Initialize the database connection
//     // await datasource.initialize();

//     const db = await SqlDatabase.fromDataSourceParams({
//       appDataSource: datasource,
//     });

//     const toolkit = new SqlToolkit(db, llm);
//     // const agentExecutor = createSqlAgent(llm, toolkit);

//     // Create the executor
//     // const agentExecutor = new AgentExecutor({
//     //   agent,
//     //   tools: toolkit.tools,
//     //   verbose: true,
//     // });

//     console.log("Executing query:", query);

//     // const result = await agentExecutor.invoke({
//     //   input: query,
//     //   verbose: true,
//     // });

//     // const result = await agentExecutor.invoke({
//     //   input: "How many users are in the database?",
//     //   verbose: true,
//     // });
//     const tools = toolkit.getTools();

//     const agentExecutor = createReactAgent({ llm, tools });

//     const result = await agentExecutor.invoke({
//       messages: [["user", query]],
//       returnIntermediateSteps: false,
//     });

//     // for await (const event of events) {
//     //   const lastMsg = event.messages[event.messages.length - 1];
//     //   if (lastMsg.tool_calls?.length) {
//     //     console.dir(lastMsg.tool_calls, { depth: null });
//     //   } else if (lastMsg.content) {
//     //     console.log("Result:", lastMsg.content);
//     //   }
//     // }

//     console.log("Result:", result);

//     // console.log(result.output);

//     // return result.output;
//   } catch (error) {
//     console.error("Error executing query:", error);
//     throw error;
//   } finally {
//     // Clean up database connection
//     // if (datasource.isInitialized) {
//     //   await datasource.destroy();
//     // }
//   }

//   // const tools = toolkit.getTools();

//   // const agentExecutor = createReactAgent({ llm, tools });

//   // const events = await agentExecutor.stream(
//   //   { messages: [["user", query]] },
//   //   { streamMode: "values" }
//   // );

//   // for await (const event of events) {
//   //   const lastMsg = event.messages[event.messages.length - 1];
//   //   if (lastMsg.tool_calls?.length) {
//   //     console.dir(lastMsg.tool_calls, { depth: null });
//   //   } else if (lastMsg.content) {
//   //     console.log(lastMsg.content);
//   //   }
//   // }

//   // console.log(
//   //   tools.map((tool) => ({
//   //     name: tool.name,
//   //     description: tool.description,
//   //   }))
//   // );
// }
