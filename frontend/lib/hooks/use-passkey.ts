"use client";

import { useState, useEffect } from "react";
import { passkeyApi } from "@/lib/api";
import {
  isWebAuthnSupported,
  isWebAuthnAvailable,
  preparePublicKeyOptions,
  preparePublicKeyRequestOptions,
  credentialToJSON,
  assertionToJSON,
} from "@/lib/passkey";
import { toast } from "sonner";

export function usePasskey() {
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsSupported(isWebAuthnSupported());
    isWebAuthnAvailable().then(setIsAvailable);
  }, []);

  const register = async (name: string = "Passkey") => {
    if (!isSupported) {
      toast.error("Passkeys not supported", {
        description: "Your browser doesn't support passkeys.",
      });
      return false;
    }

    setIsLoading(true);
    try {
      const options = await passkeyApi.beginRegistration(name);
      const preparedOptions = preparePublicKeyOptions(options);

      const credential = await navigator.credentials.create({
        publicKey: preparedOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error("Failed to create credential");
      }

      const credentialJSON = credentialToJSON(credential);
      await passkeyApi.finishRegistration(name, credentialJSON);

      toast.success("Passkey registered", {
        description: "You can now sign in with your passkey.",
      });
      return true;
    } catch (error: any) {
      console.error("Passkey registration error:", error);
      if (error.name === "NotAllowedError") {
        toast.error("Registration cancelled");
      } else {
        toast.error("Registration failed", {
          description: error.message || "Could not register passkey.",
        });
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email?: string) => {
    if (!isSupported) {
      toast.error("Passkeys not supported", {
        description: "Your browser doesn't support passkeys.",
      });
      return false;
    }

    setIsLoading(true);
    try {
      const options = await passkeyApi.beginLogin(email);
      const preparedOptions = preparePublicKeyRequestOptions(options);

      const credential = await navigator.credentials.get({
        publicKey: preparedOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error("Failed to get credential");
      }

      const assertionJSON = assertionToJSON(credential);
      await passkeyApi.finishLogin(assertionJSON);

      toast.success("Signed in successfully");
      return true;
    } catch (error: any) {
      console.error("Passkey login error:", error);
      if (error.name === "NotAllowedError") {
        toast.error("Sign in cancelled");
      } else {
        toast.error("Sign in failed", {
          description: error.message || "Could not sign in with passkey.",
        });
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    isAvailable,
    isLoading,
    register,
    login,
  };
}
