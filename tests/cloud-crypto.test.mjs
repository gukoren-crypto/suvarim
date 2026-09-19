import test from "node:test";
import assert from "node:assert/strict";
import {
  newWalletKey,
  walletCredentials,
  encryptWallet,
  decryptWallet,
} from "../src/cloud-crypto.mjs";
test("a recovery key connects two devices without revealing the encryption key to storage", async () => {
  const secret = newWalletKey();
  const first = await walletCredentials(secret);
  const second = await walletCredentials(secret);
  assert.equal(first.id, second.id);
  assert.equal(first.token, second.token);
  assert.notEqual(first.token, secret);
  const wallet = { vouchers: [{ code: "private-code" }], branches: [] };
  const payload = await encryptWallet(wallet, first);
  assert.ok(!JSON.stringify(payload).includes("private-code"));
  assert.deepEqual(await decryptWallet(payload, second), wallet);
  const other = await walletCredentials(newWalletKey());
  await assert.rejects(decryptWallet(payload, other));
  const tampered = {
    ...payload,
    data: (payload.data[0] === "0" ? "1" : "0") + payload.data.slice(1),
  };
  await assert.rejects(decryptWallet(tampered, first));
});
test("wallet encryption uses fresh nonces and validates recovery keys", async () => {
  const c = await walletCredentials(newWalletKey());
  assert.notDeepEqual(await encryptWallet({}, c), await encryptWallet({}, c));
  await assert.rejects(walletCredentials("1234"));
});
