/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';
import { BarChart, type BarChartItem } from '../BarChart.js';

expect.extend(matchers);

const sampleData: BarChartItem[] = [
  { date: '2025-05-01', dayName: 'Mon', percentage: 100, taken: 4, total: 4 },
  { date: '2025-05-02', dayName: 'Tue', percentage: 75, taken: 3, total: 4 },
  { date: '2025-05-03', dayName: 'Wed', percentage: 50, taken: 2, total: 4 },
  { date: '2025-05-04', dayName: 'Thu', percentage: 100, taken: 4, total: 4 },
  { date: '2025-05-05', dayName: 'Fri', percentage: 80, taken: 4, total: 5 },
  { date: '2025-05-06', dayName: 'Sat', percentage: 60, taken: 3, total: 5 },
  { date: '2025-05-07', dayName: 'Sun', percentage: 100, taken: 4, total: 4 },
];

describe('BarChart component', () => {
  it('R6, R8: renders SVG with role=img, aria-label, and semantic data table fallback', async () => {
    const { container } = render(<BarChart data={sampleData} />);

    // SVG role img
    const svg = screen.getByRole('img');
    expect(svg).toBeDefined();
    expect(svg.getAttribute('aria-label')).toContain('Mon 100%');

    // Semantic hidden table for screen readers
    const table = screen.getByRole('table', { hidden: true });
    expect(table).toBeDefined();
    expect(screen.getAllByRole('row', { hidden: true })).toHaveLength(8); // 1 header + 7 data

    // Zero axe violations
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
