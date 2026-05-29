import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#16181F] border border-[#1E2028] rounded-xl p-3 shadow-xl">
      <p className="text-xs text-[#8A8F9C] mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: ₹{p.value.toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  );
};

export default function SpendingAreaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="saveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E2028" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: '#8A8F9C', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#8A8F9C', fontSize: 12 }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: 12 }}
          formatter={(value) => <span style={{ color: '#8A8F9C', fontSize: 12 }}>{value}</span>}
        />
        <Area type="monotone" dataKey="spending" name="Spending" stroke="#6C63FF"
          strokeWidth={2} fill="url(#spendGrad)" dot={false} activeDot={{ r: 5, fill: '#6C63FF' }} />
        <Area type="monotone" dataKey="savings" name="Savings" stroke="#00D4AA"
          strokeWidth={2} fill="url(#saveGrad)" dot={false} activeDot={{ r: 5, fill: '#00D4AA' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
