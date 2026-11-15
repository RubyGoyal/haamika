import React from 'react';

export interface BarChartItem {
  date: string;
  dayName: string;
  percentage: number;
  taken: number;
  total: number;
}

interface BarChartProps {
  data: BarChartItem[];
  title?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title = '7-Day Medication Adherence',
}) => {
  const chartHeight = 160;
  const chartWidth = 360;
  const barWidth = 32;
  const gap = 16;
  const startX = 20;

  return (
    <div style={{ margin: '1rem 0' }}>
      <h3 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>{title}</h3>

      {/* Accessible SVG Chart */}
      <svg
        role="img"
        aria-label={`${title}: ` + data.map((d) => `${d.dayName} ${d.percentage}%`).join(', ')}
        width="100%"
        height={chartHeight + 40}
        viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
        style={{ overflow: 'visible', maxWidth: '480px' }}
      >
        {/* Baseline */}
        <line
          x1={startX - 10}
          y1={chartHeight}
          x2={startX + data.length * (barWidth + gap)}
          y2={chartHeight}
          stroke="#94a3b8"
          strokeWidth="2"
        />

        {data.map((item, idx) => {
          const x = startX + idx * (barWidth + gap);
          const barHeight = Math.max(4, Math.round((item.percentage / 100) * (chartHeight - 30)));
          const y = chartHeight - barHeight;

          // Color coded: Green >= 80%, Amber 50-79%, Red < 50%
          const fill = item.percentage >= 80 ? '#15803d' : item.percentage >= 50 ? '#b45309' : '#b91c1c';

          return (
            <g key={item.date}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="6"
                fill={fill}
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              {/* Percentage label above bar */}
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="#0f172a"
              >
                {item.percentage}%
              </text>
              {/* Day label below baseline */}
              <text
                x={x + barWidth / 2}
                y={chartHeight + 20}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="#334155"
              >
                {item.dayName}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Visually hidden semantic data table fallback for screen readers (WCAG 2.1 AA) */}
      <table className="sr-only">
        <caption>{title} data table</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Day</th>
            <th scope="col">Adherence %</th>
            <th scope="col">Taken</th>
            <th scope="col">Due</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.date}>
              <td>{item.date}</td>
              <td>{item.dayName}</td>
              <td>{item.percentage}%</td>
              <td>{item.taken}</td>
              <td>{item.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
