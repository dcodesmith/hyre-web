import { useCallback, useEffect, useRef, useState } from "react";
import { quotes } from "../data/quotes";

export function RandomQuoteTailwind() {
  const [currentQuote, setCurrentQuote] = useState(() => quotes[0]);
  const [isExiting, setIsExiting] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const selectNewQuote = useCallback(() => {
    // Start exit animation
    setIsExiting(true);

    // After exit animation, update quote and start entrance
    timeoutRef.current = setTimeout(() => {
      setCurrentQuote((prevQuote) => {
        let newIndex: number;
        do {
          newIndex = Math.floor(Math.random() * quotes.length);
        } while (quotes[newIndex].quote === prevQuote.quote);
        return quotes[newIndex];
      });
      setIsExiting(false);
      setIsEntering(true);

      // Reset entering state after animation completes
      setTimeout(() => {
        setIsEntering(false);
      }, 3000);
    }, 3000);
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(selectNewQuote, 6000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [selectNewQuote]);

  return (
    <div className="p-6 relative">
      <h2 className="text-2xl font-bold">Tailwind</h2>
      <div
        className={`
          text-center
          transition-all duration-3000
          ${
            isExiting
              ? "opacity-0 -translate-y-8 ease-in"
              : isEntering
                ? "opacity-100 translate-y-0 ease-out"
                : "opacity-100 translate-y-0"
          }
          ${isEntering ? "translate-y-0" : "translate-y-8"}
        `}
      >
        <blockquote className="mb-2 italic">&quot;{currentQuote.quote}&quot;</blockquote>
        <cite className="text-gray-600"> - {currentQuote.author}</cite>
      </div>
    </div>
  );
}
