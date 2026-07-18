import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { detectSourceType, isKnownDuplicate } from "./utils";

type EvalCase =
  | { id: string; kind: "source_type"; url: string; expected: string }
  | {
      id: string;
      kind: "known_duplicate";
      title: string;
      summary: string;
      knownTitle: string;
      knownSummary: string;
      expected: boolean;
    };

const casesPath = fileURLToPath(
  new URL("../../../../../evals/cases.jsonl", import.meta.url),
);
const cases = readFileSync(casesPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line) as EvalCase);

describe("KeyP offline evaluation set", () => {
  for (const evalCase of cases) {
    it(evalCase.id, () => {
      if (evalCase.kind === "source_type") {
        assert.equal(detectSourceType(evalCase.url), evalCase.expected);
        return;
      }
      assert.equal(
        isKnownDuplicate({ title: evalCase.title, summary: evalCase.summary }, [
          { title: evalCase.knownTitle, summary: evalCase.knownSummary },
        ]),
        evalCase.expected,
      );
    });
  }
});
