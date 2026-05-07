"use client";

import { Button } from "@/components/ui/button";
import { usePasskey } from "@/lib/hooks/use-passkey";
import { Fingerprint, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface PasskeyLoginButtonProps {
  email?: string;
  onSuccess?: () => void;
}

export function PasskeyLoginButton({ email, onSuccess }: PasskeyLoginButtonProps) {
  const router = useRouter();
  const { isSupported, isLoading, login } = usePasskey();

  if (!isSupported) {
    return null;
  }

  const handleLogin = async () => {
    const success = await login(email);
    if (success) {
      onSuccess?.();
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <Button
      onClick={handleLogin}
      disabled={isLoading}
      variant="outline"
      className="w-full"
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Fingerprint className="mr-2 h-4 w-4" />
      )}
      Sign in with Passkey
    </Button>
  );
}
