import apiClient from './client';

export type VariableType = 'Discrete' | 'Continuous' | 'Date' | 'String';

/**
 * Raw grouped response from `POST /pc/ai/classify-variables`, mirroring Gemini's shape.
 * Any bucket with no fields is omitted from the JSON (via `@JsonInclude(NON_EMPTY)`
 * on the backend), so all four fields are optional on the client.
 */
export interface ClassifyVariablesResponse {
  Date?:       string[];
  Continuous?: string[];
  Discrete?:   Record<string, string[]>;
  String?:     string[];
}

/** Flat card model consumed by the Variables tab UI. */
export interface ClassifiedVariable {
  name:   string;
  type:   VariableType;
  values: string[];
}

/** Flatten the grouped API response into an ordered list of cards for the UI. */
export const flattenClassifiedResponse = (
  grouped: ClassifyVariablesResponse,
): ClassifiedVariable[] => {
  const out: ClassifiedVariable[] = [];

  if (grouped.Discrete) {
    for (const [name, values] of Object.entries(grouped.Discrete)) {
      out.push({ name, type: 'Discrete', values: values ?? [] });
    }
  }
  (grouped.Continuous ?? []).forEach((name) =>
    out.push({ name, type: 'Continuous', values: [] }),
  );
  (grouped.Date ?? []).forEach((name) =>
    out.push({ name, type: 'Date', values: [] }),
  );
  (grouped.String ?? []).forEach((name) =>
    out.push({ name, type: 'String', values: [] }),
  );

  return out;
};

export const classifyVariables = async (
  rows: Record<string, unknown>[],
): Promise<ClassifiedVariable[]> => {
  const { data } = await apiClient.post<ClassifyVariablesResponse>(
    '/pc/ai/classify-variables',
    { rows },
  );
  return flattenClassifiedResponse(data);
};
