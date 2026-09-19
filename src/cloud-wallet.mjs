import {
  walletCredentials,
  encryptWallet,
  decryptWallet,
} from "./cloud-crypto.mjs";
import { validateBackup } from "./domain.mjs";

export class CloudConflict extends Error {
  constructor() {
    super(
      "הארנק השתנה במכשיר אחר. טענו את הגרסה החדשה לפני שמירה. השינוי הנוכחי לא נשמר.",
    );
    this.name = "CloudConflict";
  }
}
// The transport must implement atomic create and compare-and-swap write on the
// server. Authentication credentials are passed in a request body/header, not URL.
export async function openCloudWallet(
  secret,
  transport,
  cachedRevision = null,
) {
  const credentials = await walletCredentials(secret);
  let revision =
    Number.isSafeInteger(cachedRevision) && cachedRevision > 0
      ? cachedRevision
      : null;
  const auth = { id: credentials.id, token: credentials.token };
  const decode = async (row) => {
    if (!row || !Number.isSafeInteger(row.revision) || row.revision < 1)
      throw new Error("גרסת הארנק בענן אינה תקינה.");
    const wallet = validateBackup(
      await decryptWallet(row.payload, credentials),
    );
    revision = row.revision;
    return { wallet, revision };
  };
  return {
    async read() {
      return decode(await transport.read(auth));
    },
    async create(wallet) {
      const validated = validateBackup({ ...wallet, version: 1 });
      const payload = await encryptWallet(
        { ...validated, version: 1 },
        credentials,
      );
      const result = await transport.create({ ...auth, payload });
      if (result.conflict) throw new CloudConflict();
      return decode(result);
    },
    async save(wallet, expectedRevision) {
      if (revision === null || expectedRevision !== revision)
        throw new CloudConflict();
      const validated = validateBackup({ ...wallet, version: 1 });
      const payload = await encryptWallet(
        { ...validated, version: 1 },
        credentials,
      );
      const result = await transport.write({
        ...auth,
        expectedRevision,
        payload,
      });
      if (result.conflict) throw new CloudConflict();
      return decode(result);
    },
  };
}
