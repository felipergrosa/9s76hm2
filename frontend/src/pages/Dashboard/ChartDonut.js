import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

// Aceita `data` como array de objetos [{name, value}]; mantém compat com
// o formato legado de string "{'name': 'x', 'value': 1}".
const normalizeData = (data) => {
  if (Array.isArray(data) && data.length && typeof data[0] === 'object') return data;
  try {
    return JSON.parse(`[${String(data).replace(/'/g, '"')}]`);
  } catch {
    return [];
  }
};

const DonutChart = (props) => {
  const { title, value, data, color } = props;

  const items = normalizeData(data);
  const COLORS = Array.isArray(color) ? color : [color];

  const renderCenterLabel = ({ cx, cy }) => (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="bento-donut-label">
      <tspan fontWeight="bold">{title}</tspan>
      <tspan x={cx} dy="1.4em" fontWeight="bold">{`${value}%`}</tspan>
    </text>
  );

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={56}
            labelLine={false}
            strokeWidth={0}
            label={renderCenterLabel}
            isAnimationActive={false}
          >
            {items.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
export default DonutChart;
