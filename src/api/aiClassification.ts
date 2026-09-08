import apiClient from './client';

export type ClassificationStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED';

export interface ClassificationJobDto {
  jobGid: string;
  jobId: number;
  scheduleId: number;
  correlationId: string;
  rateTableName: string;
  status: ClassificationStatus;
  errorMessage: string | null;
  submittedAt: string;
  completedAt: string | null;
  /**
   * Raw AI output as a JSON string. Shape when parsed:
   *   { Date?: string[], Continuous?: string[], Discrete?: { [k]: string[] }, String?: string[] }
   */
  responsePayload: string | null;
}

/**
 * One uploaded rate table as a raw 2D grid — exactly the cells the user sees
 * in Excel, no header interpretation, no flattening. Column offsets stay
 * meaningful because blank cells are kept as empty strings.
 */
export interface RateTableGrid {
  name: string;
  grid: string[][];
}

export interface SubmitClassificationRequest {
  rateTableName: string;
  rateTables: RateTableGrid[];
}

export const submitClassification = async (
  scheduleId: number,
  body: SubmitClassificationRequest,
): Promise<ClassificationJobDto> => {
  const { data } = await apiClient.post<ClassificationJobDto>(
    `/pc/schedules/${scheduleId}/classification`,
    body,
  );
  return data;
};

export const getLatestClassification = async (
  scheduleId: number,
): Promise<ClassificationJobDto> => {
  const { data } = await apiClient.get<ClassificationJobDto>(
    `/pc/schedules/${scheduleId}/classification`,
  );
  return data;
};

/* ---------------------------------------------------------------------- */
/*  Save — one-shot persistence of variables + rate table                  */
/* ---------------------------------------------------------------------- */

export type VariableType = 'CONTINUOUS' | 'DISCRETE' | 'DATE' | 'STRING';

export interface VariableSpec {
  name: string;
  type: VariableType;
  values?: string[];        // only for DISCRETE
  defaultValue?: string;    // only for CONTINUOUS
}

export interface RateTableCell {
  coords: string[];         // one per variable, in order
  value: string;
}

export interface SaveRateTableRequest {
  rateTableName: string;
  startDate: string;        // yyyy-MM-dd
  endDate: string;
  comment?: string;
  variables: VariableSpec[];
  cells: RateTableCell[];
}

export interface SaveRateTableResponse {
  rateTableGid: string;
  variableGids: string[];
  status: 'CREATED';
}

/**
 * Persists the AI-classified variables AND the rate table in a single call.
 * Server writes variables first, then IPPFactorTable + axes + cells in one
 * transaction.
 */
export const saveRateTable = async (
  scheduleId: number,
  body: SaveRateTableRequest,
): Promise<SaveRateTableResponse> => {
  const { data } = await apiClient.post<SaveRateTableResponse>(
    `/pc/schedules/${scheduleId}/rate-tables`,
    body,
  );
  return data;
};

/* ---------------------------------------------------------------------- */
/*  Response-payload parsing                                                */
/* ---------------------------------------------------------------------- */

export interface ClassifiedBuckets {
  Date?: string[];
  Continuous?: string[];
  Discrete?: Record<string, string[]>;
  String?: string[];
}

/** Parse the JSON string in `responsePayload`. Returns null on any failure. */
export const parseClassificationResult = (
  payload: string | null | undefined,
): ClassifiedBuckets | null => {
  if (!payload) return null;
  try {
    return JSON.parse(payload) as ClassifiedBuckets;
  } catch {
    return null;
  }
};
