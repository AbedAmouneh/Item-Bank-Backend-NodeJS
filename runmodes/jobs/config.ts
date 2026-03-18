export interface JobDefinition {
  name: string;
  queueName: string;
  schedulePattern: string;
  handler: (jobId: string) => Promise<unknown>;
  options?: {
    removeOnComplete?: number;
    removeOnFail?: number;
  };
}

export interface OnDemandJobDefinition {
  name: string;
  queueName: string;
  handler: (jobId: string, data?: any) => Promise<unknown>;
  options?: {
    removeOnComplete?: number;
    removeOnFail?: number;
  };
}

export const JOBS: JobDefinition[] = [];

export const ON_DEMAND_JOBS: OnDemandJobDefinition[] = [];
