import { describe, expect, it } from "vitest";
import { seal, unseal } from "@/lib/auth/crypto";
import { includedTax } from "@/lib/settings";

describe("sealed link tokens", () => {
  it("round-trips and rejects tampering or the wrong key", () => {
    const s = seal("secret-a", "token-123");
    expect(unseal("secret-a", s)).toBe("token-123");
    expect(unseal("secret-b", s)).toBeNull();
    const parts = s.split(".");
    parts[2] = parts[2]!.slice(0, -2) + (parts[2]!.endsWith("A") ? "BB" : "AA");
    expect(unseal("secret-a", parts.join("."))).toBeNull();
    expect(seal("secret-a", "token-123")).not.toBe(s); // random IV
  });
});

describe("GST included in price", () => {
  it("backs tax out of an inclusive total", () => {
    expect(includedTax(118000, 1800)).toBe(18000);
    expect(includedTax(149900, 1800)).toBe(22866);
    expect(includedTax(149900, 0)).toBe(0);
  });
});
