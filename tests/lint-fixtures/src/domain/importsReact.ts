// NEGATIVE FIXTURE: linted as src/domain code; must fail no-restricted-imports.
import { useState } from "react";

export const leaked = useState;
