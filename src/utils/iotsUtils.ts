import type * as t from "io-ts";
import { getOrElse , isRight } from "fp-ts/lib/Either";

const stringify = (x: unknown) => JSON.stringify(x) ?? `${x}`;

const getContextPath = (context: t.Context): string =>
  context
    .slice()
    .reverse()
    .map(({ key, type }) => `${key}: ${type.name}`)
    .join(" in ");

const getMessage = (e: t.ValidationError): string =>
  e.message !== undefined
    ? e.message
    : `Invalid value ${stringify(e.value)} supplied to ${getContextPath(e.context)}`;

const getDecodeErrorMessage = (errors: t.Errors): string => errors.map(getMessage).join("\n");

/** Decodes a value with the given codec, throwing a descriptive Error on failure. */
const decodeOrThrow = <I, A>(value: I, codec: t.Decoder<I, A>): A => {
  const orElseThrow = getOrElse<t.Errors, A>((errors) => {
    throw new Error(getDecodeErrorMessage(errors));
  });
  return orElseThrow(codec.decode(value));
};

/**
 * Parses a JSON string and decodes it with the given codec.
 * Throws a descriptive Error if parsing or decoding fails.
 */
const fromJsonString = <A>(str: string, codec: t.Decoder<unknown, A>): A =>
  decodeOrThrow(JSON.parse(str) as unknown, codec);

/**
 * Decodes a value with the given codec, returning the decoded value or null on failure.
 * Use when failure is expected and should be handled gracefully rather than thrown.
 */
const decodeSafe = <I, A>(value: I, codec: t.Decoder<I, A>): A | null => {
  const result = codec.decode(value);
  return isRight(result) ? result.right : null;
};

export { decodeOrThrow, decodeSafe, fromJsonString, getDecodeErrorMessage };
