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

const CHART_HEIGHT = 160;
const CHART_WIDTH = 360;
const BAR_WIDTH = 32;
const GAP = 16;
const START_X = 20;

function getBarColor(percentage: number): string {
  if (percentage >= 80) return '#15803d';
  if (percentage >= 50) return '#b45309';
  return '#b91c1c';
}

const SvgBars: React.FC<{ data: BarChartItem[]; title: string }> = ({ data, title }) => (
  <svg
    role="img"
    aria-label={`${title}: ` + data.map((d) => `${d.dayName} ${d.percentage}%`).join(', ')}
    width="100%"
    height={CHART_HEIGHT + 40}
    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 40}`}
    style={{ overflow: 'visible', maxWidth: '480px' }}
  >
    <line
      x1={START_X - 10}
      y1={CHART_HEIGHT}
      x2={START_X + data.length * (BAR_WIDTH + GAP)}
      y2={CHART_HEIGHT}
      stroke="#94a3b8"
      strokeWidth="2"
    />
    {data.map((item, idx) => {
      const x = START_X + idx * (BAR_WIDTH + GAP);
      const barHeight = Math.max(4, Math.round((item.percentage / 100) * (CHART_HEIGHT - 30)));
      const y = CHART_HEIGHT - barHeight;
      return (
        <g key={item.date}>
          <rect
            x={x}
            y={y}
            width={BAR_WIDTH}
            height={barHeight}
            rx="6"
            fill={getBarColor(item.percentage)}
            stroke="#0f172a"
            strokeWidth="1.5"
          />
          <text
            x={x + BAR_WIDTH / 2}
            y={y - 6}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#0f172a"
          >
            {item.percentage}%
          </text>
          <text
            x={x + BAR_WIDTH / 2}
            y={CHART_HEIGHT + 20}
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
);

const SrDataTable: React.FC<{ data: BarChartItem[]; title: string }> = ({ data, title }) => (
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
);

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title = '7-Day Medication Adherence',
}) => (
  <div style={{ margin: '1rem 0' }}>
    <h3 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>{title}</h3>
    <SvgBars data={data} title={title} />
    <SrDataTable data={data} title={title} />
  </div>
);
