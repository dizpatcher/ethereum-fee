import type { Prediction } from '../types';

interface Props {
  predictions: Record<string, Prediction>;
}

const HORIZON_CONFIG: Record<
  string,
  { icon: string; shortLabel: string; colorClass: string; borderClass: string }
> = {
  next_block: {
    icon: '⚡',
    shortLabel: 'След. блок',
    colorClass: 'text-violet-300',
    borderClass: 'border-violet-500/30',
  },
  '10m': {
    icon: '🕐',
    shortLabel: '+10 мин',
    colorClass: 'text-blue-300',
    borderClass: 'border-blue-500/30',
  },
  '1h': {
    icon: '⏱',
    shortLabel: '+1 час',
    colorClass: 'text-cyan-300',
    borderClass: 'border-cyan-500/30',
  },
  '1d': {
    icon: '📅',
    shortLabel: '+1 день',
    colorClass: 'text-amber-300',
    borderClass: 'border-amber-500/30',
  },
  '1w': {
    icon: '📆',
    shortLabel: '+1 неделя',
    colorClass: 'text-rose-300',
    borderClass: 'border-rose-500/30',
  },
};

function PredictionCard({
  horizon,
  pred,
}: {
  horizon: string;
  pred: Prediction;
}) {
  const cfg = HORIZON_CONFIG[horizon];
  if (!cfg) return null;

  return (
    <div
      className={`glass-card-hover p-5 flex flex-col gap-3 border ${cfg.borderClass}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-lg">{cfg.icon}</span>
        <span className="text-xs font-medium text-white/40 bg-white/[0.05] px-2 py-0.5 rounded-full">
          {cfg.shortLabel}
        </span>
      </div>

      {/* Total fee */}
      <div>
        <div className={`font-mono text-2xl font-bold ${cfg.colorClass}`}>
          {pred.total_gwei.toFixed(3)}{' '}
          <span className="text-sm font-normal text-white/40">Gwei</span>
        </div>
        <div className="text-xs text-white/30 mt-0.5">{pred.label}</div>
      </div>

      {/* Breakdown */}
      <div className="space-y-1 text-xs text-white/50">
        <div className="flex justify-between">
          <span>Base fee</span>
          <span className="font-mono">{pred.base_fee_gwei.toFixed(4)}</span>
        </div>
        <div className="flex justify-between">
          <span>Priority fee</span>
          <span className="font-mono">{pred.priority_fee_gwei.toFixed(4)}</span>
        </div>
      </div>

      {/* Visual bar */}
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${
            horizon === 'next_block'
              ? 'from-violet-500 to-violet-400'
              : horizon === '10m'
                ? 'from-blue-500 to-blue-400'
                : horizon === '1h'
                  ? 'from-cyan-500 to-cyan-400'
                  : horizon === '1d'
                    ? 'from-amber-500 to-amber-400'
                    : 'from-rose-500 to-rose-400'
          }`}
          style={{
            width: `${Math.min(100, (pred.base_fee_gwei / (pred.total_gwei || 1)) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function PredictionGrid({ predictions }: Props) {
  const order = ['next_block', '10m', '1h', '1d', '1w'];

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest mb-4">
        Прогноз комиссии сети
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {order.map((h) =>
          predictions[h] ? (
            <PredictionCard key={h} horizon={h} pred={predictions[h]} />
          ) : null,
        )}
      </div>
      <p className="mt-3 text-xs text-white/20">
        * Прогноз на 1 день и 1 неделю является приблизительным из-за ограниченной глубины кэша.
      </p>
    </section>
  );
}
