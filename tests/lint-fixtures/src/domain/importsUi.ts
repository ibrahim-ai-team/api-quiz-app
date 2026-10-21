// NEGATIVE FIXTURE: linted as src/domain code; must fail no-restricted-imports.
import { Danger } from "../ui/Danger";

export const leaked = Danger;
