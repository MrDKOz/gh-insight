import { isRight } from "fp-ts/lib/Either";
import * as t from "io-ts";
import { getDecodeErrorMessage } from "./iotsUtils";

const RegionCodec = t.union([
  t.literal("england-and-wales"),
  t.literal("scotland"),
  t.literal("northern-ireland"),
  t.literal("US"),
]);

const ImportConfigCodec = t.intersection([
  t.type({ version: t.literal(1) }),
  t.partial({
    dark:  t.boolean,
    token: t.string,
    settings: t.partial({
      highlightWeekends:     t.boolean,
      colorblindMode:        t.boolean,
      highlightBankHolidays: t.boolean,
      bankHolidayRegions:    t.array(RegionCodec),
    }),
  }),
]);

type ImportedConfig = t.TypeOf<typeof ImportConfigCodec>;

/**
 * Parses raw JSON (already parsed to `unknown`) from a config import file.
 * Returns the validated config, or a string describing why the file was rejected.
 */
const parseImportConfig = (raw: unknown): ImportedConfig | string => {
  const result = ImportConfigCodec.decode(raw);
  return isRight(result) ? result.right : getDecodeErrorMessage(result.left);
};

export { parseImportConfig };
export type { ImportedConfig };
