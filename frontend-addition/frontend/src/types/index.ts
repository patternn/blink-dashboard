export interface Metrics {
  activeUsers: number;
  transactions: number;
  newUsers: number;
  btcCustody: number;
  countriesActive: number;
  updatedAt: string;
}

export interface MetricsSnapshot extends Metrics {
  snapshotId: string;
}

export interface WsEvent<T = unknown> {
  type: "metrics:update" | "metrics:snapshot" | "error";
  data: T;
  timestamp: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error?: string;
}
