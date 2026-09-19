import test from "node:test";
import assert from "node:assert/strict";
import { newWalletKey } from "../src/cloud-crypto.mjs";
import { openCloudWallet, CloudConflict } from "../src/cloud-wallet.mjs";
const empty = { vouchers: [], branches: [] };
function memoryTransport() {
  let row = null,
    token = null;
  const check = (a) => {
    if (a.token !== token) throw new Error("unauthorized");
  };
  return {
    async create(a) {
      if (row) return { conflict: true };
      token = a.token;
      row = { payload: a.payload, revision: 1 };
      return row;
    },
    async read(a) {
      check(a);
      return row;
    },
    async write(a) {
      check(a);
      if (a.expectedRevision !== row.revision) return { conflict: true };
      row = { revision: row.revision + 1, payload: a.payload };
      return row;
    },
  };
}
test("two devices synchronize and a stale device cannot overwrite changes", async () => {
  const secret = newWalletKey(),
    transport = memoryTransport();
  const a = await openCloudWallet(secret, transport),
    b = await openCloudWallet(secret, transport);
  await a.create(empty);
  await b.read();
  const update = {
    ...empty,
    branches: [
      {
        id: "x",
        store: "FOX",
        city: "test",
        address: "test",
        lat: 32,
        lng: 34,
      },
    ],
  };
  await a.save(update, 1);
  await assert.rejects(b.save(empty, 1), CloudConflict);
  assert.deepEqual((await b.read()).wallet, update);
  await b.save(empty, 2);
  assert.deepEqual((await a.read()).wallet, empty);
  await assert.rejects(a.create(empty), CloudConflict);
});
test("transport failures do not report a successful save or advance revision", async () => {
  const t = memoryTransport(),
    a = await openCloudWallet(newWalletKey(), t);
  await a.create(empty);
  const write = t.write;
  t.write = async () => {
    throw new Error("offline");
  };
  await assert.rejects(a.save(empty, 1), /offline/);
  t.write = write;
  assert.equal((await a.save(empty, 1)).revision, 2);
});
