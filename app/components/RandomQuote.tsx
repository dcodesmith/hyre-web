import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useRef, useEffect } from "react";
import { quotes } from "../quotes";
// Move animation variants outside component to prevent recreation
const quoteVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3, // Faster entrance
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 3, // Slower exit
      ease: "easeIn",
    },
  },
};

export function RandomQuote() {
  const [currentQuote, setCurrentQuote] = useState(() => quotes[0]); // Lazy initial state
  const [isVisible, setIsVisible] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout>();
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Memoize the quote selection function
  const selectNewQuote = useCallback(() => {
    setIsVisible(false);

    timeoutRef.current = setTimeout(() => {
      setCurrentQuote((prevQuote) => {
        let newIndex;
        do {
          newIndex = Math.floor(Math.random() * quotes.length);
        } while (quotes[newIndex].quote === prevQuote.quote); // Ensure we don't show the same quote twice
        return quotes[newIndex];
      });
      setIsVisible(true);
    }, 3000); // Match this with the exit duration
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(selectNewQuote, 5000);

    return () => {
      // Clean up all timers
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [selectNewQuote]);

  return (
    <div className="p-6 relative">
      <h2 className="text-2xl font-bold">FramerMotion</h2>
      <AnimatePresence mode="wait" initial={false}>
        {isVisible && (
          <motion.div
            key={currentQuote.quote}
            variants={quoteVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="text-center"
          >
            <motion.blockquote className="italic" layout>
              &quot;{currentQuote.quote}&quot;
            </motion.blockquote>
            <motion.cite className="text-gray-600" layout>
              - {currentQuote.author}
            </motion.cite>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
