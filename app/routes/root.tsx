import { useFetcher } from "@remix-run/react";
import * as React from "react";
import { LoginModal } from "../components/LoginModal";
import { VerifyModal } from "../components/VerifyModal";

export default function Root() {
  const [isLoginOpen, setIsLoginOpen] = React.useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = React.useState(false);
  const [email, setEmail] = React.useState<string>();
  const loginFetcher = useFetcher({ key: "login" });
  const verifyFetcher = useFetcher({ key: "verify" });
  //   const { authEmail, authError } = useLoaderData();

  //   const fetcher = useFetcher();

  console.log("loginFetcher", loginFetcher);
  console.log("verifyFetcher", verifyFetcher);
  //   console.log("authEmail", authEmail);
  //   console.log("authError", authError);

  //   console.log("actionData", actionData);

  React.useEffect(() => {
    if (loginFetcher.state === "idle" && loginFetcher.data?.success) {
      setIsLoginOpen(false);
      setIsVerifyOpen(true);
      setEmail(loginFetcher.data.email);
    }
  }, [loginFetcher.state, loginFetcher.data]);

  return (
    <div>
      <button
        onClick={() => setIsLoginOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-white"
      >
        Login
      </button>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      <VerifyModal isOpen={isVerifyOpen} onClose={() => setIsVerifyOpen(false)} email={email} />
    </div>
  );
}
