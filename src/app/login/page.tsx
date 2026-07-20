import { signIn } from "@/lib/auth";
import { LoginView } from "./login-view";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const callbackUrl = searchParams.callbackUrl ?? "/projects";

  async function handleSignIn() {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: callbackUrl });
  }

  return <LoginView error={searchParams.error} onSignIn={handleSignIn} />;
}
