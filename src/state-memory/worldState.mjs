import { extractFacts } from "./extractFacts.mjs";
import { applyFacts, createWorldState } from "./updateState.mjs";

export function buildWorldState(events) {
  return events.reduce((state, event) => applyFacts(state, extractFacts(event)), createWorldState());
}
