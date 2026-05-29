import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-[#16181F] border border-[#1E2028] rounded-xl p-3 shadow-xl">
      <p className="text-xs text-[#8A8F9C]">{d.name}</p>
      <p className="text-sm font-semibold" style={{ color: d.payload.color }}>
        ₹{d.value.toLocaleString('en-IN')}
      </p>
      <p className="text-xs text-[#8A8F9C]">{d.payload.percent ? `${(d.payload.percent*100).toFixed(1)}%` : ''}</p>
    </div>
  );
};

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.07) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * Math.PI / 180);
  const y = cy + r * Math.sin(-midAngle * Math.PI / 180);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function CategoryPieChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={60} outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          labelLine={false}
          label={CustomLabel}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ color: '#8A8F9C', fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
