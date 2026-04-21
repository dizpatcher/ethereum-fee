import { useState } from 'react';
import type { GasUnit, Prediction, WalletState } from '../types';

interface Props {
  predictions: Record<string, Prediction>;
  gasUnits: Record<string, GasUnit>;
  ethPrice: number;
  wallet: WalletState;
}

const HORIZONS = [
  { key: 'next_block', label: 'Сейчас' },
  { key: '10m', label: '+10 мин' },
  { key: '1h', label: '+1 час' },
  { key: '1d', label: '+1 день' },
];

// ERC-20 transfer(address,uint256) selector
const TRANSFER_SELECTOR = '0xa9059cbb';

function padHex(hex: string, bytes = 32): string {
  return hex.replace('0x', '').padStart(bytes * 2, '0');
}

function encodeErc20Transfer(to: string, amount: bigint): string {
  return `${TRANSFER_SELECTOR}${padHex(to)}${padHex(amount.toString(16))}`;
}

export default function TransactionEstimator({
  predictions,
  gasUnits,
  ethPrice,
  wallet,
}: Props) {
  const [txType, setTxType] = useState('eth_transfer');
  const [horizon, setHorizon] = useState('next_block');
  const [toAddress, setToAddress] = useState('');
  const [ethAmount, setEthAmount] = useState('');
  const [tokenContract, setTokenContract] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState('18');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const pred = predictions[horizon];
  const unit = gasUnits[txType];

  const baseFeeWei = pred ? BigInt(pred.base_fee_wei) : 0n;
  const priorityFeeWei = pred ? BigInt(pred.priority_fee_wei) : 0n;
  const maxFeeWei = baseFeeWei + priorityFeeWei;
  const gasCostEth =
    pred && unit ? (Number(maxFeeWei) * unit.gas) / 1e18 : 0;
  const gasCostUsd = gasCostEth * ethPrice;

  const needsAddress = ['eth_transfer', 'erc20_transfer', 'nft_mint', 'nft_transfer'].includes(txType);
  const isEth = txType === 'eth_transfer';
  const isErc20 = txType === 'erc20_transfer';

  const canSend =
    wallet.account &&
    (isEth ? toAddress && ethAmount : isErc20 ? toAddress && tokenContract && tokenAmount : false);

  async function handleSend() {
    if (!wallet.account || !pred || !unit) return;
    setStatus('pending');
    setTxHash(null);
    setTxError(null);

    try {
      const gas = `0x${unit.gas.toString(16)}`;
      const maxFee = `0x${maxFeeWei.toString(16)}`;
      const priority = `0x${priorityFeeWei.toString(16)}`;

      let params: Record<string, string>;

      if (isEth) {
        const valueWei = BigInt(Math.floor(parseFloat(ethAmount) * 1e18));
        params = {
          to: toAddress,
          value: `0x${valueWei.toString(16)}`,
          gas,
          maxFeePerGas: maxFee,
          maxPriorityFeePerGas: priority,
        };
      } else if (isErc20) {
        const dec = parseInt(tokenDecimals, 10);
        const amtWei = BigInt(Math.floor(parseFloat(tokenAmount) * 10 ** dec));
        params = {
          to: tokenContract,
          value: '0x0',
          data: encodeErc20Transfer(toAddress, amtWei),
          gas,
          maxFeePerGas: maxFee,
          maxPriorityFeePerGas: priority,
        };
      } else {
        return;
      }

      const hash = (await wallet.sendTransaction(params)) as string;
      setTxHash(hash);
      setStatus('success');
    } catch (e) {
      setTxError(e instanceof Error ? e.message : 'Транзакция отклонена');
      setStatus('error');
    }
  }

  return (
    <section className="mt-8 glass-card p-6">
      <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest mb-6">
        Оценка стоимости транзакции
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT: form */}
        <div className="space-y-4">
          {/* Transaction type */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Тип транзакции</label>
            <select
              value={txType}
              onChange={(e) => setTxType(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 transition-colors"
            >
              {Object.entries(gasUnits).map(([key, u]) => (
                <option key={key} value={key} className="bg-[#1a1a2e]">
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          {/* Horizon */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Время отправки</label>
            <div className="flex gap-2 flex-wrap">
              {HORIZONS.filter((h) => predictions[h.key]).map((h) => (
                <button
                  key={h.key}
                  onClick={() => setHorizon(h.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    horizon === h.key
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.09]'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Address */}
          {needsAddress && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Адрес получателя</label>
              <input
                type="text"
                placeholder="0x..."
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-colors"
              />
            </div>
          )}

          {/* ETH amount */}
          {isEth && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Количество ETH</label>
              <input
                type="number"
                placeholder="0.01"
                min="0"
                step="0.001"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-colors"
              />
            </div>
          )}

          {/* ERC-20 fields */}
          {isErc20 && (
            <>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Контракт токена</label>
                <input
                  type="text"
                  placeholder="0x... (USDT, USDC, ...)"
                  value={tokenContract}
                  onChange={(e) => setTokenContract(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-colors"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-white/50 mb-1.5">Количество</label>
                  <input
                    type="number"
                    placeholder="100"
                    value={tokenAmount}
                    onChange={(e) => setTokenAmount(e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Decimals</label>
                  <input
                    type="number"
                    value={tokenDecimals}
                    onChange={(e) => setTokenDecimals(e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-violet-500/60 transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {/* Send button */}
          {(isEth || isErc20) && (
            <div className="pt-2">
              {!wallet.account ? (
                <button
                  onClick={wallet.connect}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-all shadow-lg shadow-violet-500/20"
                >
                  Подключить кошелёк для отправки
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!canSend || status === 'pending'}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-all shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2"
                >
                  {status === 'pending' ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Ожидание подтверждения…
                    </>
                  ) : (
                    'Открыть в кошельке'
                  )}
                </button>
              )}
            </div>
          )}

          {/* Tx result */}
          {status === 'success' && txHash && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono break-all">
              ✓ Транзакция отправлена: {txHash}
            </div>
          )}
          {status === 'error' && txError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {txError}
            </div>
          )}
        </div>

        {/* RIGHT: cost estimate */}
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-4">
            <p className="text-xs text-white/40 uppercase tracking-widest">Оценка стоимости</p>

            <div className="space-y-2 text-sm">
              <Row label="Тип" value={unit?.label ?? '—'} />
              <Row label="Gas limit" value={unit?.gas.toLocaleString() ?? '—'} mono />
              <Row
                label="Base fee"
                value={pred ? `${pred.base_fee_gwei.toFixed(4)} Gwei` : '—'}
                mono
              />
              <Row
                label="Priority fee"
                value={pred ? `${pred.priority_fee_gwei.toFixed(4)} Gwei` : '—'}
                mono
              />
            </div>

            <div className="border-t border-white/[0.08] pt-4 space-y-2">
              <Row
                label="Комиссия сети (ETH)"
                value={gasCostEth ? `${gasCostEth.toFixed(6)} ETH` : '—'}
                mono
                highlight
              />
              <Row
                label="Комиссия сети (USD)"
                value={gasCostUsd ? `$${gasCostUsd.toFixed(4)}` : '—'}
                mono
                highlight
              />
            </div>
          </div>

          <div className="glass-card p-5 text-xs text-white/40 space-y-1 leading-relaxed">
            <p className="text-white/60 font-medium mb-2">Как это работает</p>
            <p>
              Прогноз комиссии рассчитывается моделями LightGBM, обученными на исторических данных
              блокчейна Ethereum. Модели предсказывают <strong className="text-white/60">base fee</strong>{' '}
              и <strong className="text-white/60">priority fee</strong> для каждого горизонта.
            </p>
            <p className="mt-2">
              Итоговая стоимость = (base_fee + priority_fee) × gas_limit × цена ETH.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-white/40">{label}</span>
      <span
        className={`${mono ? 'font-mono' : ''} ${
          highlight ? 'text-violet-300 font-semibold' : 'text-white/80'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
