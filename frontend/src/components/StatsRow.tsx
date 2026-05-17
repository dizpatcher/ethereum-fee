import type { Currency, CurrentGas } from '../types';

interface Props {
  current: CurrentGas;
  ethPriceUsd: number;
  ethPriceRub: number;
  currency: Currency;
  updatedAt: string;
}

function UtilDot({ pct }: { pct: number }) {
  const color = pct < 50 ? '#0098AF' : pct < 80 ? '#355CA8' : '#D80F16';
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ background: color, boxShadow: `0 0 6px ${color}88` }}
    />
  );
}

function fiatCost(gwei: number, gasUnits: number, ethPriceUsd: number, ethPriceRub: number, currency: Currency) {
  const eth = (gwei * gasUnits) / 1e9;
  if (currency === 'RUB') {
    const rub = eth * ethPriceRub;
    return rub.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽';
  }
  const usd = eth * ethPriceUsd;
  return '$' + usd.toFixed(4);
}

function ethPriceFormatted(usd: number, rub: number, currency: Currency) {
  if (currency === 'RUB') return rub.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
  return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StatsRow({ current, ethPriceUsd, ethPriceRub, currency, updatedAt }: Props) {
  const updated = new Date(updatedAt).toLocaleTimeString('ru-RU');

  return (
    <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* ETH Price */}
      <div className="glass-card p-5 flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(37,101,105,0.65)' }}>
          Цена ETH
        </span>
        <span className="stat-value gradient-text">
          {ethPriceFormatted(ethPriceUsd, ethPriceRub, currency)}
        </span>
        <span className="text-xs" style={{ color: 'rgba(37,101,105,0.45)' }}>Обновлено: {updated}</span>
      </div>

      {/* Current Base Fee */}
      <div className="glass-card p-5 flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(37,101,105,0.65)' }}>
          Текущая Base Fee
        </span>
        <div className="flex items-end gap-2">
          <span className="stat-value text-fa-dark">
            {current.base_fee_gwei.toFixed(3)}
          </span>
          <span className="mb-0.5 text-sm" style={{ color: 'rgba(37,101,105,0.55)' }}>Gwei</span>
        </div>
        <div className="text-xs" style={{ color: 'rgba(37,101,105,0.55)' }}>
          Priority: +{current.priority_fee_gwei.toFixed(3)} Gwei
        </div>
      </div>

      {/* Стоимость перевода ETH прямо сейчас */}
      <div className="glass-card p-5 flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(37,101,105,0.65)' }}>
          Перевод ETH сейчас
        </span>
        <div className="flex items-end gap-2">
          <span className="stat-value" style={{ color: '#0098AF' }}>
            {fiatCost(current.total_gwei, 21_000, ethPriceUsd, ethPriceRub, currency)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(37,101,105,0.55)' }}>
          <UtilDot pct={current.block_utilization} />
          <span>Блок #{current.block_number?.toLocaleString()}</span>
          <span>·</span>
          <span>{current.block_utilization}% заполнен</span>
        </div>
      </div>
    </section>
  );
}
