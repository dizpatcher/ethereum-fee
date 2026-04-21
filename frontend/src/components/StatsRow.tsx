import type { CurrentGas } from '../types';

interface Props {
  current: CurrentGas;
  ethPrice: number;
  updatedAt: string;
}

function Dot({ pct }: { pct: number }) {
  const color =
    pct < 50 ? 'bg-emerald-400' : pct < 80 ? 'bg-amber-400' : 'bg-rose-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export default function StatsRow({ current, ethPrice, updatedAt }: Props) {
  const totalUsd = (current.total_gwei * 21_000 * ethPrice) / 1e9;
  const updated = new Date(updatedAt).toLocaleTimeString('ru-RU');

  return (
    <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* ETH Price */}
      <div className="glass-card p-5 flex flex-col gap-2">
        <span className="text-xs font-medium text-white/40 uppercase tracking-widest">
          Цена ETH
        </span>
        <span className="stat-value gradient-text">
          $
          {ethPrice.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <span className="text-xs text-white/30">Обновлено: {updated}</span>
      </div>

      {/* Current Base Fee */}
      <div className="glass-card p-5 flex flex-col gap-2">
        <span className="text-xs font-medium text-white/40 uppercase tracking-widest">
          Текущая Base Fee
        </span>
        <div className="flex items-end gap-2">
          <span className="stat-value text-violet-300">
            {current.base_fee_gwei.toFixed(3)}
          </span>
          <span className="text-white/40 mb-0.5 text-sm">Gwei</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>Priority: +{current.priority_fee_gwei.toFixed(3)} Gwei</span>
        </div>
      </div>

      {/* Block & Utilization */}
      <div className="glass-card p-5 flex flex-col gap-2">
        <span className="text-xs font-medium text-white/40 uppercase tracking-widest">
          Перевод ETH сейчас
        </span>
        <div className="flex items-end gap-2">
          <span className="stat-value text-emerald-300">
            ${totalUsd.toFixed(4)}
          </span>
          <span className="text-white/40 mb-0.5 text-sm">USD</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Dot pct={current.block_utilization} />
          <span>Блок #{current.block_number?.toLocaleString()}</span>
          <span>·</span>
          <span>{current.block_utilization}% заполнен</span>
        </div>
      </div>
    </section>
  );
}
