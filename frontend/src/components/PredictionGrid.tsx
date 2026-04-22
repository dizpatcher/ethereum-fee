import type { Currency, Prediction } from '../types';

interface Props {
  predictions: Record<string, Prediction>;
  ethPriceUsd: number;
  ethPriceRub: number;
  currency: Currency;
}

const HORIZON_CONFIG: Record<
  string,
  { icon: string; shortLabel: string; color: string; borderColor: string; gradFrom: string; gradTo: string }
> = {
  next_block: { icon: '⚡', shortLabel: 'След. блок', color: '#0098AF', borderColor: 'rgba(0,152,175,0.30)', gradFrom: '#006B80', gradTo: '#0098AF' },
  '10m':      { icon: '🕐', shortLabel: '+10 мин',    color: '#00a5c4', borderColor: 'rgba(0,152,175,0.22)', gradFrom: '#256569', gradTo: '#006B80' },
  '1h':       { icon: '⏱',  shortLabel: '+1 час',     color: '#4d9fa8', borderColor: 'rgba(37,101,105,0.35)', gradFrom: '#1e4f53', gradTo: '#256569' },
  '1d':       { icon: '📅', shortLabel: '+1 день',    color: '#7b9fd4', borderColor: 'rgba(53,92,168,0.30)', gradFrom: '#2a4a8a', gradTo: '#355CA8' },
  '1w':       { icon: '📆', shortLabel: '+1 неделя',  color: '#e85560', borderColor: 'rgba(216,15,22,0.28)', gradFrom: '#a80a10', gradTo: '#D80F16' },
};

function gweiToFiat(gwei: number, gasUnits: number, usd: number, rub: number, currency: Currency) {
  const eth = (gwei * gasUnits) / 1e9;
  if (currency === 'RUB') {
    return (eth * rub).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
  }
  return '$' + (eth * usd).toFixed(3);
}

function PredictionCard({
  horizon, pred, ethPriceUsd, ethPriceRub, currency,
}: {
  horizon: string;
  pred: Prediction;
  ethPriceUsd: number;
  ethPriceRub: number;
  currency: Currency;
}) {
  const cfg = HORIZON_CONFIG[horizon];
  if (!cfg) return null;
  const basePct = Math.min(100, (pred.base_fee_gwei / (pred.total_gwei || 1)) * 100);

  return (
    <div className="glass-card-hover p-5 flex flex-col gap-3" style={{ borderColor: cfg.borderColor }}>
      <div className="flex items-center justify-between">
        <span className="text-lg">{cfg.icon}</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${cfg.color}18`, color: cfg.color }}>
          {cfg.shortLabel}
        </span>
      </div>

      {/* Gwei */}
      <div>
        <div className="font-mono text-2xl font-bold" style={{ color: cfg.color }}>
          {pred.total_gwei.toFixed(3)}{' '}
          <span className="text-sm font-normal text-white/35">Gwei</span>
        </div>
        <div className="text-xs text-white/30 mt-0.5">{pred.label}</div>
      </div>

      {/* Стоимость в фиате для ETH-перевода (21 000 gas) */}
      <div className="text-xs font-mono" style={{ color: cfg.color + 'cc' }}>
        ≈ {gweiToFiat(pred.total_gwei, 21_000, ethPriceUsd, ethPriceRub, currency)}
        <span className="text-white/25 font-sans ml-1">/ перевод ETH</span>
      </div>

      {/* Разбивка */}
      <div className="space-y-1 text-xs text-white/45">
        <div className="flex justify-between">
          <span>Base fee</span>
          <span className="font-mono">{pred.base_fee_gwei.toFixed(4)}</span>
        </div>
        <div className="flex justify-between">
          <span>Priority fee</span>
          <span className="font-mono">{pred.priority_fee_gwei.toFixed(4)}</span>
        </div>
      </div>

      {/* Полоска соотношения */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full"
             style={{ width: `${basePct}%`, background: `linear-gradient(to right, ${cfg.gradFrom}, ${cfg.gradTo})` }} />
      </div>
    </div>
  );
}

export default function PredictionGrid({ predictions, ethPriceUsd, ethPriceRub, currency }: Props) {
  const order = ['next_block', '10m', '1h', '1d', '1w'];
  return (
    <section className="mt-8">
      <h2 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: 'rgba(0,152,175,0.55)' }}>
        Прогноз комиссии сети
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {order.map((h) =>
          predictions[h] ? (
            <PredictionCard key={h} horizon={h} pred={predictions[h]}
              ethPriceUsd={ethPriceUsd} ethPriceRub={ethPriceRub} currency={currency} />
          ) : null,
        )}
      </div>
      <p className="mt-3 text-xs text-white/20">
        * Прогноз на 1 день и 1 неделю является приблизительным из-за ограниченной глубины кэша.
      </p>
    </section>
  );
}
