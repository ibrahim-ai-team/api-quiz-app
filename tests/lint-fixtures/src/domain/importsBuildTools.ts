// NEGATIVE FIXTURE: linted as src/domain code; the domain block overrides the
// rule options, so it must still ban zod and scripts/ (2 errors).
import { z } from "zod";
import { CONTENT_SCHEMA_VERSION } from "../../../../scripts/content/schema.ts";

export const leaked = [z, CONTENT_SCHEMA_VERSION];
