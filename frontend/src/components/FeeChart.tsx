import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Prediction } from '../types';

interface Props {
  predictions: Record<string, Prediction>;
}

const LABELS: Record<string, string> = {
  next_block: 'Сейчас',
  '10m': '+10 мин',
  '1h': '+1 час',
  '1d': '+1 день',
  '1w': '+1 нед.',
};

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-4 py-3 text-sm">
      <p className="font-semibold text-white mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }} className="font-mono">
          {p.name}: {p.value.toFixed(4)} Gwei
        </p>
      ))}
    </div>
  );
}

export default function FeeChart({ predictions }: Props) {
  const order = ['next_block', '10m', '1h', '1d', '1w'];
  const data = order
    .filter((h) => predictions[h])
    .map((h) => ({
      name: LABELS[h],
      'Base Fee': Number(predictions[h].base_fee_gwei.toFixed(4)),
      'Priority Fee': Number(predictions[h].priority_fee_gwei.toFixed(4)),
    }));

  return (
    <section className="mt-8 glass-card p-6">
      <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest mb-6">
        График прогнозируемых комиссий (Gwei)
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="name"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', paddingTop: 12 }}
          />
          <Bar dataKey="Base Fee" stackId="a" fill="#7c3aed" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Priority Fee" stackId="a" fill="#06b6d4" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
