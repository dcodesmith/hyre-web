import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";
import * as React from "react";
import { Button } from "~/components/ui/button";
import { LoginModal } from "../components/LoginModal";
import { VerifyModal } from "../components/VerifyModal";

export default function Root() {
  const [isLoginOpen, setIsLoginOpen] = React.useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = React.useState(false);
  const [email, setEmail] = React.useState<string>();
  const loginFetcher = useFetcher({ key: "login" });
  const verifyFetcher = useFetcher({ key: "verify" });

  useEffect(() => {
    if (loginFetcher.state === "idle" && loginFetcher.data?.success) {
      setIsLoginOpen(false);
      setIsVerifyOpen(true);
      setEmail(loginFetcher.data.email);
    }
  }, [loginFetcher.state, loginFetcher.data]);

  return (
    <div>
      <Button
        onClick={() => setIsLoginOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-white"
      >
        Login
      </Button>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      <VerifyModal isOpen={isVerifyOpen} onClose={() => setIsVerifyOpen(false)} email={email} />
    </div>
  );
}
