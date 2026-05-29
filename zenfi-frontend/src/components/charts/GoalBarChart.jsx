import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#16181F] border border-[#1E2028] rounded-xl p-3 shadow-xl">
      <p className="text-xs text-[#8A8F9C] mb-1">{label}</p>
      <p className="text-sm font-semibold text-[#6C63FF]">
        {payload[0].value}% saved
      </p>
    </div>
  );
};

export default function GoalBarChart({ goals }) {
  const data = goals.map(g => ({
    name: g.title.length > 10 ? g.title.slice(0, 10) + '…' : g.title,
    progress: Math.round((g.saved_amount / g.target_amount) * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }} barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E2028" horizontal={false} />
        <XAxis dataKey="name" tick={{ fill: '#8A8F9C', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#8A8F9C', fontSize: 11 }} axisLine={false} tickLine={false}
          domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1E2028' }} />
        <Bar dataKey="progress" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => {
            const color = entry.progress >= 80 ? '#00D4AA' : entry.progress >= 50 ? '#6C63FF' : '#FFB547';
            return <Cell key={i} fill={color} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
