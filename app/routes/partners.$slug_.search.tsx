import { type LoaderFunctionArgs } from "react-router";
import SearchPage, { loader as searchLoader } from "./search";
export { meta } from "./search";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Partner slug is required", { status: 400 });
  }

  return searchLoader({ request, params } as LoaderFunctionArgs);
}

export default SearchPage;
