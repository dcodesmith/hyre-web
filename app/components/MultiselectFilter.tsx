import { useState, useRef, useEffect } from "react";

interface MultiselectFilterProps {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  label: string;
  disabled?: boolean; // Add this line
}

export default function MultiselectFilter({
  options,
  selectedOptions,
  onChange,
  label,
  disabled = false, // Add this line with a default value
}: MultiselectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, []);

  const getDisplayText = () => {
    if (selectedOptions.length === 0) {
      return label;
    } else if (selectedOptions.length <= 2) {
      return selectedOptions.join(", ");
    } else {
      return `${selectedOptions.length} selected`;
    }
  };

  return (
    <div className="relative w-full sm:w-auto" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)} // Update this line
        className={`bg-white border w-full border-gray-300 rounded-md px-4 py-2 inline-flex items-center min-w-[150px] justify-between ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`} // Update this line
        disabled={disabled} // Add this line
      >
        <span className="truncate">{getDisplayText()}</span>
        <svg className="ml-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto">
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedOptions.includes(option)}
                onChange={() => {
                  const newSelected = selectedOptions.includes(option)
                    ? selectedOptions.filter((item) => item !== option)
                    : [...selectedOptions, option];
                  onChange(newSelected);
                }}
                className="mr-2"
              />
              {option}
              {/* <span className="truncate">{option}</span> */}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
