import apiClient from './client';

export type ScheduleType = 'PCE' | 'VestedComp';

export interface CreatePcScheduleRequest {
  scheduleType: ScheduleType;
  description?: string;
  startDate: string;
  endDate: string;
  productGid?: string;
  modelName?: string;
  modelComment?: string;
}

export interface PcScheduleDto {
  scheduleGid: string;
  scheduleId: number;
  scheduleType: string;
  description: string | null;
  startDate: string;
  endDate: string;
  calculationBaseGid: string;
  integrationMapGid: string;
  percentage: number | null;
}

export interface CreatedSchedule {
  scheduleGid: string;
  scheduleId: number;
  calculationBaseGid: string;
  integrationMapGid: string;
  percentage: number;
}

export interface PageResponse<T> {
  data: T[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

export const createPcSchedule = async (
  payload: CreatePcScheduleRequest,
): Promise<CreatedSchedule> => {
  const { data } = await apiClient.post<CreatedSchedule>('/pc/schedules', payload);
  return data;
};

export interface UpdatedPercentage {
  scheduleId: number;
  percentage: number;
}

/** PUT the wizard-progress percentage (0–100) onto an existing schedule. */
export const updateSchedulePercentage = async (
  scheduleId: number,
  percentage: number,
): Promise<UpdatedPercentage> => {
  const { data } = await apiClient.put<UpdatedPercentage>(
    `/pc/schedules/${scheduleId}/percentage`,
    { percentage },
  );
  return data;
};

export const listPcSchedules = async (
  pageNumber = 1,
  pageSize = 20,
): Promise<PageResponse<PcScheduleDto>> => {
  const { data } = await apiClient.get<PageResponse<PcScheduleDto>>('/pc/schedules', {
    params: { pageNumber, pageSize },
  });
  return data;
};

export const getPcSchedule = async (
  scheduleId: number,
): Promise<PcScheduleDto> => {
  const { data } = await apiClient.get<PcScheduleDto>(
    `/pc/schedules/${scheduleId}`,
  );
  return data;
};

export interface ProductDto {
  gid: string;
  name: string;
}

export const searchProducts = async (
  query = '',
  limit = 50,
): Promise<ProductDto[]> => {
  const { data } = await apiClient.get<ProductDto[]>('/pc/products', {
    params: { query, limit },
  });
  return data;
};

/* ---------------------------------------------------------------------- */
/*  Schedule Setup — variables + factor table steps in one transaction     */
/* ---------------------------------------------------------------------- */

export interface DiscreteVariableSetupDto {
  name: string;
  parentGid?: string;
  children?: DiscreteVariableSetupDto[];
}

export interface SimpleVariableSetupDto {
  name: string;
}

export interface VariablesSetupRequest {
  discrete?: DiscreteVariableSetupDto[];
  continuous?: SimpleVariableSetupDto[];
  date?: SimpleVariableSetupDto[];
  string?: SimpleVariableSetupDto[];
}

export interface AddFactorTablePayload {
  name: string;
  comment?: string;
  startDate: string;
  endDate: string;
  cellType: 'NUMERIC';
}

export interface AddAxisPayload {
  kind: 'DISCRETE' | 'CONTINUOUS' | 'DATE' | 'STRING';
  variableRef: { byName?: string; byGid?: string };
  isTopAxis: boolean;
  axisOrder: number;
  depth: number;
}

export interface CoordPayload {
  childOfVariable: string;
  byName: string;
}

export interface CellSetupPayload {
  coords: CoordPayload[];
  value: number;
}

export interface SetCellValuesPayload {
  cells: CellSetupPayload[];
}

export type StepCommand = 'AddFactorTable' | 'AddAxis' | 'SetCellValues';

export interface StepDto {
  command: StepCommand;
  as?: string;
  tableRef?: string;
  payload: AddFactorTablePayload | AddAxisPayload | SetCellValuesPayload;
}

export interface FactorTableStepsRequest {
  steps: StepDto[];
}

export interface CreatePcScheduleSetupRequest {
  variables?: VariablesSetupRequest;
  factorTables?: FactorTableStepsRequest;
}

export interface CreatedVariableDto {
  name: string;
  gid: string;
  parentGid?: string;
}

export interface CreatedPcScheduleSetup {
  scheduleGid: string;
  variables?: {
    scheduleGid: string;
    discrete?: CreatedVariableDto[];
    continuous?: CreatedVariableDto[];
    date?: CreatedVariableDto[];
    string?: CreatedVariableDto[];
  };
  factorTables?: {
    scheduleGid: string;
    results: { as?: string; command: string; gid: string; cellsWritten?: number }[];
  };
}

export const scheduleSetup = async (
  scheduleGid: string,
  body: CreatePcScheduleSetupRequest,
): Promise<CreatedPcScheduleSetup> => {
  const { data } = await apiClient.post<CreatedPcScheduleSetup>(
    '/pc/schedule-setup',
    body,
    { params: { scheduleGid } },
  );
  return data;
};

/* ---------------------------------------------------------------------- */
/*  Schedule Setup — GET variables + rate tables for an existing schedule  */
/* ---------------------------------------------------------------------- */

export interface ReadVariableDto {
  name: string;
  gid: string;
}

export interface ReadDiscreteVariableDto {
  name: string;
  gid: string;
  children: ReadVariableDto[];
}

export interface ScheduleVariablesResponse {
  scheduleGid: string;
  continuous: ReadVariableDto[];
  date: ReadVariableDto[];
  string: ReadVariableDto[];
  discrete: ReadDiscreteVariableDto[];
}

export interface RateTableAxisDto {
  gid: string;
  kind: 'CONTINUOUS' | 'DATE' | 'STRING' | 'DISCRETE';
  variableName: string;
  isTopAxis: boolean;
  axisOrder: number;
  buckets: string[];
}

export interface RateTableCoordDto {
  variableName: string;
  byName: string;
}

export interface RateTableCellDto {
  coords: RateTableCoordDto[];
  value: number;
}

export interface RateTableDto {
  gid: string;
  name: string;
  comment: string | null;
  startDate: string | null;
  endDate: string | null;
  axes: RateTableAxisDto[];
  cells: RateTableCellDto[];
}

export interface ScheduleRateTablesResponse {
  scheduleGid: string;
  rateTables: RateTableDto[];
}

/** GET the variables persisted under a schedule (for the Variables board). */
export const getScheduleVariables = async (
  scheduleGid: string,
): Promise<ScheduleVariablesResponse> => {
  const { data } = await apiClient.get<ScheduleVariablesResponse>(
    '/pc/schedule-setup/variables',
    { params: { scheduleGid } },
  );
  return data;
};

/** GET the rate tables (axes + cells) persisted under a schedule. */
export const getScheduleRateTables = async (
  scheduleGid: string,
): Promise<ScheduleRateTablesResponse> => {
  const { data } = await apiClient.get<ScheduleRateTablesResponse>(
    '/pc/schedule-setup/rate-tables',
    { params: { scheduleGid } },
  );
  return data;
};
