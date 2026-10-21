// NEGATIVE FIXTURE: linted as src/content code; must fail no-restricted-imports
// three times (zod, a zod subpath, and a path into scripts/).
import { z } from "zod";
import { z as zv4 } from "zod/v4";
import { questionSchema } from "../../../../scripts/content/schema.ts";

export const leaked = [z, zv4, questionSchema];
