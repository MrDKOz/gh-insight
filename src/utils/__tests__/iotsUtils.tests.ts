import * as t from "io-ts";
import { decodeOrThrow, decodeSafe, getDecodeErrorMessage } from "../iotsUtils";

const NumberCodec  = t.number;
const StringCodec  = t.string;
const ObjectCodec  = t.type({ name: t.string, age: t.number });

describe("decodeOrThrow", () => {
  it("returns the decoded value when input is valid", () => {
    expect(decodeOrThrow(42, NumberCodec)).toBe(42);
    expect(decodeOrThrow("hello", StringCodec)).toBe("hello");
    expect(decodeOrThrow({ name: "Alice", age: 30 }, ObjectCodec)).toEqual({ name: "Alice", age: 30 });
  });

  it("throws an Error when the input is invalid", () => {
    expect(() => decodeOrThrow("not a number", NumberCodec)).toThrow(Error);
    expect(() => decodeOrThrow({ name: 123 }, ObjectCodec)).toThrow(Error);
  });

  it("error message describes the invalid value and expected type", () => {
    let message = "";
    try { decodeOrThrow("oops", NumberCodec); } catch (e) { message = (e as Error).message; }

    expect(message).toContain("oops");
    expect(message).toContain("number");
  });
});

describe("decodeSafe", () => {
  it("returns the decoded value when input is valid", () => {
    expect(decodeSafe(42, NumberCodec)).toBe(42);
    expect(decodeSafe({ name: "Bob", age: 25 }, ObjectCodec)).toEqual({ name: "Bob", age: 25 });
  });

  it("returns null when the input is invalid", () => {
    expect(decodeSafe("not a number", NumberCodec)).toBeNull();
    expect(decodeSafe(null, NumberCodec)).toBeNull();
    expect(decodeSafe({ name: 999 }, ObjectCodec)).toBeNull();
  });
});

describe("getDecodeErrorMessage", () => {
  it("produces a non-empty message for a failed decode", () => {
    const result = NumberCodec.decode("bad");

    if (result._tag === "Right") { throw new Error("Expected Left"); }
    const msg = getDecodeErrorMessage(result.left);

    expect(msg.length).toBeGreaterThan(0);
    expect(msg).toContain("bad");
  });

  it("joins multiple errors with newlines", () => {
    // A union that always fails gives two errors
    const codec = t.union([t.literal("a"), t.literal("b")]);
    const result = codec.decode("c");

    if (result._tag === "Right") { throw new Error("Expected Left"); }
    const msg = getDecodeErrorMessage(result.left);

    expect(msg).toContain("\n");
  });
});
