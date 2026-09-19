// A random recovery key identifies an encrypted wallet. It is never put in a URL.
const encoder = new TextEncoder();
const hex = (bytes) =>
  [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const bytes = (value) =>
  Uint8Array.from(value.match(/../g), (v) => parseInt(v, 16));
export function newWalletKey() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}
export async function walletCredentials(secret) {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error("מפתח הארנק אינו תקין.");
  const normalized = secret.toLowerCase();
  const derive = (label) =>
    crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`suvarim-v1:${label}:${normalized}`),
    );
  const [id, token, key] = await Promise.all(
    ["id", "access", "encryption"].map(derive),
  );
  return {
    id: hex(id),
    token: hex(token),
    key: await crypto.subtle.importKey("raw", key, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]),
  };
}
export async function encryptWallet(wallet, credentials) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(credentials.id) },
    credentials.key,
    encoder.encode(JSON.stringify(wallet)),
  );
  return { format: 1, iv: hex(iv), data: hex(encrypted) };
}
export async function decryptWallet(payload, credentials) {
  if (
    payload?.format !== 1 ||
    !/^[a-f0-9]{24}$/.test(payload.iv) ||
    typeof payload.data !== "string" ||
    !/^(?:[a-f0-9]{2})+$/.test(payload.data)
  )
    throw new Error("הנתונים בענן אינם תקינים.");
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytes(payload.iv),
      additionalData: encoder.encode(credentials.id),
    },
    credentials.key,
    bytes(payload.data),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
