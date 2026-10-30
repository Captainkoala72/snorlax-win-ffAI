import { isOpenAIModel, type ChatModel } from "./models";

export type ReasoningEffort = "high" | "xhigh" | "max";
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "high";
export const REASONING_EFFORTS: Array<{ id: ReasoningEffort; label: string; hint: string }> = [
  { id: "high", label: "High", hint: "Thorough reasoning for everyday analysis" },
  { id: "xhigh", label: "XHigh", hint: "Deeper reasoning for harder decisions" },
  { id: "max", label: "Max", hint: "Maximum reasoning for the most complex questions" },
];
export function reasoningEffortFor(model: ChatModel, value: unknown): ReasoningEffort {
  if (!isOpenAIModel(model)) return "max";
  return REASONING_EFFORTS.find((effort) => effort.id === value)?.id ?? DEFAULT_REASONING_EFFORT;
}
