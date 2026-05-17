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

// Цвета баров из брендбука
const COLOR_BASE     = '#256569'; // тёмно-бирюзовый — base fee
const COLOR_PRIORITY = '#0098AF'; // яркий бирюзовый — priority fee

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-4 py-3 text-sm rounded-xl"
      style={{
        background: 'rgba(255,255,255,0.98)',
        border: '1px solid rgba(37,101,105,0.2)',
        boxShadow: '0 4px 16px rgba(37,101,105,0.12)',
      }}
    >
      <p className="font-semibold mb-2" style={{ color: '#0f2424' }}>{label}</p>
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
      'Base Fee':     Number(predictions[h].base_fee_gwei.toFixed(4)),
      'Priority Fee': Number(predictions[h].priority_fee_gwei.toFixed(4)),
    }));

  return (
    <section className="mt-8 glass-card p-6">
      <h2 className="text-xs font-medium uppercase tracking-widest mb-6" style={{ color: 'rgba(37,101,105,0.65)' }}>
        График прогнозируемых комиссий (Gwei)
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barCategoryGap="32%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(37,101,105,0.10)" />
          <XAxis
            dataKey="name"
            tick={{ fill: 'rgba(37,101,105,0.7)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(37,101,105,0.6)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(37,101,105,0.05)' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: 'rgba(37,101,105,0.7)', paddingTop: 14 }}
          />
          <Bar dataKey="Base Fee"     stackId="a" fill={COLOR_BASE}     radius={[0, 0, 0, 0]} />
          <Bar dataKey="Priority Fee" stackId="a" fill={COLOR_PRIORITY} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
