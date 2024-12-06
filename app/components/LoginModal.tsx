import { useFetcher } from "@remix-run/react";
import * as React from "react";
import { Dialog, DialogContent } from "./ui/dialog";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const fetcher = useFetcher({ key: "login" });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetcher.submit(e.currentTarget, { method: "post", action: "/auth/login" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        {/* method="post" action="/auth/login" */}
        <fetcher.Form onSubmit={onSubmit}>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
