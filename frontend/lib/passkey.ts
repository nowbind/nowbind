export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === "function"
  );
}

export async function isWebAuthnAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function base64URLToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function preparePublicKeyOptions(
  options: PublicKeyCredentialCreationOptions
): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64URLToBuffer(options.challenge as unknown as string),
    user: {
      ...options.user,
      id: base64URLToBuffer(options.user.id as unknown as string),
    },
    excludeCredentials: options.excludeCredentials?.map((cred) => ({
      ...cred,
      id: base64URLToBuffer(cred.id as unknown as string),
    })),
  };
}

export function preparePublicKeyRequestOptions(
  options: PublicKeyCredentialRequestOptions
): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64URLToBuffer(options.challenge as unknown as string),
    allowCredentials: options.allowCredentials?.map((cred) => ({
      ...cred,
      id: base64URLToBuffer(cred.id as unknown as string),
    })),
  };
}

export function credentialToJSON(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64URL(response.clientDataJSON),
      attestationObject: bufferToBase64URL(response.attestationObject),
      transports: (response as any).getTransports?.() || [],
    },
  };
}

export function assertionToJSON(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64URL(response.clientDataJSON),
      authenticatorData: bufferToBase64URL(response.authenticatorData),
      signature: bufferToBase64URL(response.signature),
      userHandle: response.userHandle ? bufferToBase64URL(response.userHandle) : null,
    },
  };
}
