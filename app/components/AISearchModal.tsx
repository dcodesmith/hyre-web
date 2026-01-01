import { useNavigate } from "@remix-run/react";
import { Sparkles, X, Loader2, CheckCircle, AlertCircle, Plane, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";

interface AISearchModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface AISearchResponse {
  readonly params: Record<string, string>;
  readonly interpretation?: string;
  readonly error?: string;
}

export function AISearchModal({ isOpen, onClose }: AISearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validationStatus, setValidationStatus] = useState<string>("");
  const [flightDetails, setFlightDetails] = useState<string>("");
  const aiSearchAbortControllerRef = useRef<AbortController | null>(null);
  const flightValidationAbortControllerRef = useRef<AbortController | null>(null);

  /**
   * Validates flight with timeout. Returns null if timeout/error (graceful degradation).
   */
  const validateFlightWithTimeout = async (
    flightNumber: string,
    date: string,
    signal?: AbortSignal,
  ): Promise<{
    success: boolean;
    flight?: {
      actualArrival?: string;
      estimatedArrival?: string;
      scheduledArrival: string;
    };
    error?: string;
    message?: string;
    warning?: string;
  } | null> => {
    try {
      // Create timeout promise (2 seconds)
      const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
        setTimeout(() => resolve({ timeout: true }), 2000),
      );

      // Create validation promise
      const validationPromise = (async () => {
        const res = await fetch(`/api/search-flight?flightNumber=${flightNumber}&date=${date}`, {
          signal,
        });
        if (!res.ok) {
          throw new Error(`Flight validation failed: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })();

      // Race between validation and timeout
      const result = await Promise.race([validationPromise, timeoutPromise]);

      // Handle timeout - return null for graceful degradation
      if ("timeout" in result && result.timeout) {
        return null;
      }

      return result as {
        success: boolean;
        flight?: {
          actualArrival?: string;
          estimatedArrival?: string;
          scheduledArrival: string;
        };
        error?: string;
        message?: string;
        warning?: string;
      };
    } catch (error) {
      // Handle abort gracefully
      if (error instanceof Error && error.name === "AbortError") {
        return null; // Aborted, graceful degradation
      }
      console.error("Flight validation error:", error);
      return null; // Graceful degradation
    }
  };

  /**
   * Handles airport pickup flight validation and updates UI state
   */
  const handleAirportPickupValidation = async (
    flightNumber: string,
    date: string,
  ): Promise<boolean> => {
    setValidationStatus(`Validating flight ${flightNumber}...`);

    // Create abort controller for flight validation
    flightValidationAbortControllerRef.current = new AbortController();

    try {
      const flightData = await validateFlightWithTimeout(
        flightNumber,
        date,
        flightValidationAbortControllerRef.current.signal,
      );

      // Timeout or error - gracefully continue
      if (!flightData) {
        setValidationStatus("Taking longer than expected, redirecting...");
        await new Promise((resolve) => setTimeout(resolve, 500));
        return true; // Continue to search page
      }

      // Flight not valid for airport pickup
      // Case 1: success: false, error: "..." (flight not found)
      // Case 2: success: true, message: "...", flight: null (wrong destination)
      if (!flightData.flight) {
        // Prioritize message over error (message is for wrong destination)
        const errorMsg = flightData.message || flightData.error || "Flight not found";

        // Show error in the validation status box (stays visible)
        setValidationStatus(errorMsg);
        setFlightDetails(""); // Clear any previous flight details
        setIsLoading(false);

        // Don't redirect - keep modal open so user can fix
        return false;
      }

      // Flight validated successfully!
      const flight = flightData.flight;
      const arrivalTime = new Date(
        flight.actualArrival || flight.estimatedArrival || flight.scheduledArrival,
      );
      const arrivalTimeStr = arrivalTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      setFlightDetails(`${flightNumber.toUpperCase()} • Arrives ${arrivalTimeStr}`);
      setValidationStatus("Flight validated!");

      // Show warning if exists
      if (flightData.warning) {
        toast.warning(flightData.warning);
      }

      // Brief pause to show success state
      await new Promise((resolve) => setTimeout(resolve, 800));

      return true; // Continue to search page
    } finally {
      flightValidationAbortControllerRef.current = null;
    }
  };

  const handleSearch = async () => {
    if (isLoading) {
      return;
    }

    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    // If a search is already in progress, abort it first
    if (aiSearchAbortControllerRef.current !== null) {
      aiSearchAbortControllerRef.current.abort();
    }

    setIsLoading(true);
    setValidationStatus(""); // Clear validation status - only show during flight validation
    setFlightDetails("");

    // Create new abort controller for AI search
    aiSearchAbortControllerRef.current = new AbortController();

    try {
      // Step 1: Extract parameters with AI
      const response = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: aiSearchAbortControllerRef.current.signal,
      });

      if (!response.ok) {
        let errorMessage = "Failed to process search";
        try {
          const errorData: AISearchResponse = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If JSON parse fails, try to read as text
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch {
            // Use default error message
          }
        }
        toast.error(errorMessage);
        setValidationStatus("");
        setIsLoading(false);
        aiSearchAbortControllerRef.current = null;
        return;
      }

      const data: AISearchResponse = await response.json();

      if (data.error) {
        toast.error(data.error);
        setValidationStatus("");
        setIsLoading(false);
        aiSearchAbortControllerRef.current = null;
        return;
      }

      // Build search URL with extracted parameters
      const searchParams = new URLSearchParams(data.params);
      const searchUrl = `/search?${searchParams.toString()}`;

      // Step 2: If airport pickup, validate flight (Option C: Hybrid)
      const isAirportPickup =
        data.params.bookingType === "AIRPORT_PICKUP" &&
        data.params.flightNumber &&
        data.params.from;

      if (isAirportPickup) {
        const shouldContinue = await handleAirportPickupValidation(
          data.params.flightNumber,
          data.params.from,
        );

        if (!shouldContinue) {
          aiSearchAbortControllerRef.current = null;
          return; // Validation failed, stay in modal
        }
      } else {
        // Not airport pickup - show interpretation
        if (data.interpretation) {
          toast.success(data.interpretation);
        }
      }

      // Navigate to search results
      navigate(searchUrl);
      onClose();
      setQuery("");
      setValidationStatus("");
      setFlightDetails("");
    } catch (error) {
      // Handle abort gracefully
      if (error instanceof Error && error.name === "AbortError") {
        // Request was aborted, don't show error
        return;
      }
      console.error("AI Search error:", error);
      toast.error("Something went wrong. Please try again.");
      setValidationStatus("");
    } finally {
      setIsLoading(false);
      aiSearchAbortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (but allow Shift+Enter for new lines)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Allow cancel-and-restart behavior - handleSearch will abort existing request
      handleSearch();
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setValidationStatus("");
      setFlightDetails("");
      setIsLoading(false);

      // Abort any in-flight requests and reset
      if (aiSearchAbortControllerRef.current) {
        aiSearchAbortControllerRef.current.abort();
        aiSearchAbortControllerRef.current = null;
      }
      if (flightValidationAbortControllerRef.current) {
        flightValidationAbortControllerRef.current.abort();
        flightValidationAbortControllerRef.current = null;
      }
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogHeader>
            <DialogDescription className="text-gray-600 mt-2 text-left">
              Describe what you're looking for in natural language. For example: "I need a black
              Toyota SUV from today for 5 days"
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Chat-like input */}
          <div className="relative">
            <Textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="E.g., I need a luxury sedan for tomorrow night, or a white SUV for airport pickup..."
              className="min-h-[100px] resize-none text-sm placeholder:text-sm placeholder:text-gray-400"
              disabled={isLoading}
              autoFocus
            />
            {query && !isLoading && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear input"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Validation Status - Shows during flight validation */}
          {validationStatus && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                {flightDetails ? (
                  // Success state - flight validated
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : isLoading ? (
                  // Loading state - validating
                  <Loader2 className="h-5 w-5 text-gray-700 flex-shrink-0 mt-0.5 animate-spin" />
                ) : (
                  // Error state - validation failed
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{validationStatus}</p>
                  {flightDetails && (
                    <div className="flex items-center gap-2 mt-1">
                      <Plane className="h-4 w-4 text-gray-600" />
                      <p className="text-sm text-gray-700">{flightDetails}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Example queries */}
          {!validationStatus && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Try these examples:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Black Toyota SUV for 5 days",
                  "Luxury sedan tomorrow night",
                  "Airport pickup for BA75 tomorrow",
                  "Executive car for 3 days starting today",
                ].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setQuery(example)}
                    className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    disabled={isLoading}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search button */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSearch}
              disabled={!query.trim() || isLoading}
              className="flex-1 rounded-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
            <Button
              onClick={() => {
                // Abort any in-flight requests
                if (aiSearchAbortControllerRef.current) {
                  aiSearchAbortControllerRef.current.abort();
                  aiSearchAbortControllerRef.current = null;
                }
                if (flightValidationAbortControllerRef.current) {
                  flightValidationAbortControllerRef.current.abort();
                  flightValidationAbortControllerRef.current = null;
                }
                onClose();
              }}
              variant="outline"
              size="lg"
              className="rounded-full"
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* Info footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-lg">
          <p className="text-xs text-gray-500 text-center">
            Powered by AI • Understands dates, colors, car types, and more
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
