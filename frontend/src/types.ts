export interface GasFee {
  base_fee_gwei: number;
  priority_fee_gwei: number;
  total_gwei: number;
  base_fee_wei: number;
  priority_fee_wei: number;
}

export interface CurrentGas extends GasFee {
  block_number: number;
  block_utilization: number;
}

export interface Prediction extends GasFee {
  label: string;
}

export interface GasUnit {
  label: string;
  gas: number;
}

export interface GasData {
  eth_price: number;
  current: CurrentGas;
  predictions: Record<string, Prediction>;
  gas_units: Record<string, GasUnit>;
  updated_at: string;
}

export interface WalletState {
  account: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendTransaction: (params: Record<string, string>) => Promise<unknown>;
}
