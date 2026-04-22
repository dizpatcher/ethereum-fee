import { useState } from 'react';
import type { Currency, GasUnit, Prediction, WalletState } from '../types';

interface Props {
  predictions: Record<string, Prediction>;
  gasUnits: Record<string, GasUnit>;
  ethPriceUsd: number;
  ethPriceRub: number;
  currency: Currency;
  wallet: WalletState;
}

const HORIZONS = [
  { key: 'next_block', label: 'Сейчас' },
  { key: '10m',        label: '+10 мин' },
  { key: '1h',         label: '+1 час' },
  { key: '1d',         label: '+1 день' },
];

const INPUT_CLASS =
  'w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none transition-colors font-mono';
const INPUT_STYLE   = { background: 'rgba(37,101,105,0.10)', border: '1px solid rgba(0,152,175,0.18)' };
const INPUT_FOCUS   = { borderColor: 'rgba(0,152,175,0.55)' };

const TRANSFER_SELECTOR = '0xa9059cbb';
function padHex(hex: string, bytes = 32) { return hex.replace('0x', '').padStart(bytes * 2, '0'); }
function encodeErc20Transfer(to: string, amount: bigint) {
  return `${TRANSFER_SELECTOR}${padHex(to)}${padHex(amount.toString(16))}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: 'rgba(0,152,175,0.7)' }}>{label}</label>
      {children}
    </div>
  );
}

function formatFiat(eth: number, usd: number, rub: number, currency: Currency) {
  if (!eth) return '—';
  if (currency === 'RUB') return (eth * rub).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽';
  return '$' + (eth * usd).toFixed(4);
}

export default function TransactionEstimator({ predictions, gasUnits, ethPriceUsd, ethPriceRub, currency, wallet }: Props) {
  const [txType, setTxType]           = useState('eth_transfer');
  const [horizon, setHorizon]         = useState('next_block');
  const [toAddress, setToAddress]     = useState('');
  const [ethAmount, setEthAmount]     = useState('');
  const [tokenContract, setTokenContract] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState('18');
  const [status, setStatus]           = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [txHash, setTxHash]           = useState<string | null>(null);
  const [txError, setTxError]         = useState<string | null>(null);

  const pred = predictions[horizon];
  const unit = gasUnits[txType];

  const baseFeeWei     = pred ? BigInt(pred.base_fee_wei) : 0n;
  const priorityFeeWei = pred ? BigInt(pred.priority_fee_wei) : 0n;
  const maxFeeWei      = baseFeeWei + priorityFeeWei;
  const gasCostEth     = pred && unit ? (Number(maxFeeWei) * unit.gas) / 1e18 : 0;

  const needsAddress = ['eth_transfer', 'erc20_transfer', 'nft_mint', 'nft_transfer'].includes(txType);
  const isEth   = txType === 'eth_transfer';
  const isErc20 = txType === 'erc20_transfer';
  const canSend = wallet.account && (isEth ? toAddress && ethAmount : isErc20 ? toAddress && tokenContract && tokenAmount : false);

  async function handleSend() {
    if (!wallet.account || !pred || !unit) return;
    setStatus('pending'); setTxHash(null); setTxError(null);
    try {
      const gas      = `0x${unit.gas.toString(16)}`;
      const maxFee   = `0x${maxFeeWei.toString(16)}`;
      const priority = `0x${priorityFeeWei.toString(16)}`;
      let params: Record<string, string>;
      if (isEth) {
        const valueWei = BigInt(Math.floor(parseFloat(ethAmount) * 1e18));
        params = { to: toAddress, value: `0x${valueWei.toString(16)}`, gas, maxFeePerGas: maxFee, maxPriorityFeePerGas: priority };
      } else if (isErc20) {
        const dec    = parseInt(tokenDecimals, 10);
        const amtWei = BigInt(Math.floor(parseFloat(tokenAmount) * 10 ** dec));
        params = { to: tokenContract, value: '0x0', data: encodeErc20Transfer(toAddress, amtWei), gas, maxFeePerGas: maxFee, maxPriorityFeePerGas: priority };
      } else return;
      const hash = (await wallet.sendTransaction(params)) as string;
      setTxHash(hash); setStatus('success');
    } catch (e) {
      setTxError(e instanceof Error ? e.message : 'Транзакция отклонена');
      setStatus('error');
    }
  }

  return (
    <section className="mt-8 glass-card p-6">
      <h2 className="text-xs font-medium uppercase tracking-widest mb-6" style={{ color: 'rgba(0,152,175,0.55)' }}>
        Оценка стоимости транзакции
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT: форма */}
        <div className="space-y-4">
          <Field label="Тип транзакции">
            <select value={txType} onChange={(e) => setTxType(e.target.value)}
                    className={INPUT_CLASS} style={INPUT_STYLE}
                    onFocus={(e) => Object.assign(e.target.style, INPUT_FOCUS)}
                    onBlur={(e) => Object.assign(e.target.style, INPUT_STYLE)}>
              {Object.entries(gasUnits).map(([key, u]) => (
                <option key={key} value={key}>{u.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Время отправки">
            <div className="flex gap-2 flex-wrap">
              {HORIZONS.filter((h) => predictions[h.key]).map((h) => (
                <button key={h.key} onClick={() => setHorizon(h.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${horizon === h.key ? 'pill-active' : 'pill-inactive'}`}>
                  {h.label}
                </button>
              ))}
            </div>
          </Field>

          {needsAddress && (
            <Field label="Адрес получателя">
              <input type="text" placeholder="0x..." value={toAddress}
                     onChange={(e) => setToAddress(e.target.value)}
                     className={INPUT_CLASS} style={INPUT_STYLE}
                     onFocus={(e) => Object.assign(e.target.style, INPUT_FOCUS)}
                     onBlur={(e) => Object.assign(e.target.style, INPUT_STYLE)} />
            </Field>
          )}

          {isEth && (
            <Field label="Количество ETH">
              <input type="number" placeholder="0.01" min="0" step="0.001" value={ethAmount}
                     onChange={(e) => setEthAmount(e.target.value)}
                     className={INPUT_CLASS} style={INPUT_STYLE}
                     onFocus={(e) => Object.assign(e.target.style, INPUT_FOCUS)}
                     onBlur={(e) => Object.assign(e.target.style, INPUT_STYLE)} />
            </Field>
          )}

          {isErc20 && (
            <>
              <Field label="Контракт токена">
                <input type="text" placeholder="0x... (USDT, USDC, ...)" value={tokenContract}
                       onChange={(e) => setTokenContract(e.target.value)}
                       className={INPUT_CLASS} style={INPUT_STYLE}
                       onFocus={(e) => Object.assign(e.target.style, INPUT_FOCUS)}
                       onBlur={(e) => Object.assign(e.target.style, INPUT_STYLE)} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="Количество">
                    <input type="number" placeholder="100" value={tokenAmount}
                           onChange={(e) => setTokenAmount(e.target.value)}
                           className={INPUT_CLASS} style={INPUT_STYLE}
                           onFocus={(e) => Object.assign(e.target.style, INPUT_FOCUS)}
                           onBlur={(e) => Object.assign(e.target.style, INPUT_STYLE)} />
                  </Field>
                </div>
                <div>
                  <Field label="Decimals">
                    <input type="number" value={tokenDecimals}
                           onChange={(e) => setTokenDecimals(e.target.value)}
                           className={INPUT_CLASS} style={INPUT_STYLE}
                           onFocus={(e) => Object.assign(e.target.style, INPUT_FOCUS)}
                           onBlur={(e) => Object.assign(e.target.style, INPUT_STYLE)} />
                  </Field>
                </div>
              </div>
            </>
          )}

          {(isEth || isErc20) && (
            <div className="pt-2">
              {!wallet.account ? (
                <button onClick={wallet.connect}
                        className="w-full py-3 rounded-xl text-white font-medium text-sm transition-all"
                        style={{ background: 'linear-gradient(135deg, #006B80, #0098AF)', boxShadow: '0 0 20px -4px rgba(0,152,175,0.45)' }}>
                  Подключить кошелёк для отправки
                </button>
              ) : (
                <button onClick={handleSend} disabled={!canSend || status === 'pending'}
                        className="w-full py-3 rounded-xl text-white font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, #006B80, #0098AF)', boxShadow: '0 0 20px -4px rgba(0,152,175,0.4)' }}>
                  {status === 'pending' ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Ожидание подтверждения…</>
                  ) : 'Открыть в кошельке'}
                </button>
              )}
            </div>
          )}

          {status === 'success' && txHash && (
            <div className="p-3 rounded-xl text-xs font-mono break-all"
                 style={{ background: 'rgba(0,152,175,0.10)', border: '1px solid rgba(0,152,175,0.25)', color: '#0098AF' }}>
              ✓ Транзакция отправлена: {txHash}
            </div>
          )}
          {status === 'error' && txError && (
            <div className="p-3 rounded-xl text-xs"
                 style={{ background: 'rgba(216,15,22,0.08)', border: '1px solid rgba(216,15,22,0.22)', color: '#ff6b70' }}>
              {txError}
            </div>
          )}
        </div>

        {/* RIGHT: расчёт */}
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-4">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(0,152,175,0.55)' }}>Оценка стоимости</p>

            <div className="space-y-2 text-sm">
              <Row label="Тип"          value={unit?.label ?? '—'} />
              <Row label="Gas limit"    value={unit?.gas.toLocaleString() ?? '—'} mono />
              <Row label="Base fee"     value={pred ? `${pred.base_fee_gwei.toFixed(4)} Gwei` : '—'} mono />
              <Row label="Priority fee" value={pred ? `${pred.priority_fee_gwei.toFixed(4)} Gwei` : '—'} mono />
            </div>

            <div className="pt-4 space-y-2" style={{ borderTop: '1px solid rgba(0,152,175,0.10)' }}>
              <Row label="Комиссия (ETH)"
                   value={gasCostEth ? `${gasCostEth.toFixed(6)} ETH` : '—'} mono />
              <Row label={`Комиссия (${currency === 'RUB' ? '₽' : '$'})`}
                   value={formatFiat(gasCostEth, ethPriceUsd, ethPriceRub, currency)}
                   mono highlight />
            </div>
          </div>

          <div className="glass-card p-5 text-xs space-y-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
            <p className="font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Как это работает</p>
            <p>
              Прогноз комиссии рассчитывается моделями LightGBM, обученными на исторических данных
              блокчейна Ethereum. Модели предсказывают{' '}
              <strong style={{ color: '#0098AF' }}>base fee</strong> и{' '}
              <strong style={{ color: '#0098AF' }}>priority fee</strong> для каждого горизонта.
            </p>
            <p className="mt-2">
              Итоговая стоимость = (base_fee + priority_fee) × gas_limit × курс ETH/{currency}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, mono = false, highlight = false }: {
  label: string; value: string; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-white/40">{label}</span>
      <span className={mono ? 'font-mono' : ''}
            style={highlight ? { color: '#0098AF', fontWeight: 600 } : { color: 'rgba(255,255,255,0.78)' }}>
        {value}
      </span>
    </div>
  );
}
