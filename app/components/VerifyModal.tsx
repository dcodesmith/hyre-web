import { useFetcher } from "@remix-run/react";
import * as React from "react";
import { Dialog, DialogContent } from "./ui/dialog";
interface VerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  email?: string;
}

export function VerifyModal({ isOpen, onClose, email }: VerifyModalProps) {
  const fetcher = useFetcher({ key: "verify" });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetcher.submit(e.currentTarget, { method: "post", action: "/auth/verify" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <fetcher.Form onSubmit={onSubmit}>
          <div className="mt-4 space-y-4">
            <input type="hidden" name="email" value={email} />

            <div>
              <label htmlFor="code" className="block text-sm font-medium">
                Enter verification code
              </label>
              <input
                type="text"
                name="code"
                id="code"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Enter code sent to your email"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Verify
            </button>
          </div>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
