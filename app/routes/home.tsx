import { RandomQuote } from "~/components/RandomQuote";
import { RandomQuoteTailwind } from "~/components/RandomQuoteTailwind";

export default function Home() {
  return (
    <div className="flex flex-row gap-4">
      <div className="w-1/2">
        <RandomQuote />
      </div>
      <div className="w-1/2">
        <RandomQuoteTailwind />
      </div>
    </div>
  );
}
