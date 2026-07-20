import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPrivateAddress, probePublicUrl } from "./urlSafety.js";

describe("KeyP URL safety", () => {
  it("recognizes local and reserved addresses", () => {
    assert.equal(isPrivateAddress("127.0.0.1"), true);
    assert.equal(isPrivateAddress("10.1.2.3"), true);
    assert.equal(isPrivateAddress("192.168.10.5"), true);
    assert.equal(isPrivateAddress("100.64.0.1"), true);
    assert.equal(isPrivateAddress("198.51.100.4"), true);
    assert.equal(isPrivateAddress("::ffff:127.0.0.1"), true);
    assert.equal(isPrivateAddress("ff02::1"), true);
    assert.equal(isPrivateAddress("::1"), true);
    assert.equal(isPrivateAddress("8.8.8.8"), false);
  });

  it("rejects private hosts before fetching", async () => {
    assert.deepEqual(await probePublicUrl("http://127.0.0.1/admin"), {
      ok: false,
      reason: "private_ip",
    });
    assert.deepEqual(await probePublicUrl("http://localhost/private"), {
      ok: false,
      reason: "private_host",
    });
  });
});
