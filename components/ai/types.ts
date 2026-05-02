export type AskUserQuestion = {
  question: string;
  options?: {
    label: string;
    description?: string;
  }[];
  multiSelect?: boolean;
};

export type AskUserInput = {
  questions: AskUserQuestion[];
};

export type ToolLabels = Record<
  string,
  {
    active: (input: Record<string, unknown>) => string;
    complete: (input: Record<string, unknown>) => string;
  }
>;
