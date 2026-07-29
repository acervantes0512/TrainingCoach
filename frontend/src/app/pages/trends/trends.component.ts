import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { GoalProgress, HistoryPoint } from '../../models';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, Chart } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

type RangePreset = '3m' | '6m' | '1y' | '2y' | 'all' | 'custom';

@Component({
  selector: 'app-trends',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './trends.component.html',
  styleUrl: './trends.component.scss',
})
export class TrendsComponent implements OnInit {
  private api = inject(ApiService);

  activeRange = signal<RangePreset>('all');
  customFrom = '';
  customTo = '';

  goalsProgress = signal<GoalProgress[]>([]);

  waistChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  armsChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  weightChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  nutritionChartData = signal<ChartConfiguration<'bar'>['data']>({ labels: [], datasets: [] });

  lineOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: {
      title: (items) => {
        const idx = items[0]?.dataIndex;
        const raw = (items[0]?.chart?.data as { rawDates?: string[] }).rawDates;
        if (raw && raw[idx]) {
          const d = new Date(raw[idx] + 'T12:00:00');
          return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
        return items[0]?.label || '';
      }
    }}},
  };

  barOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
  };

  goalChartConfigs = signal<{ goal: GoalProgress; data: ChartConfiguration<'line'>['data']; options: ChartConfiguration<'line'>['options'] }[]>([]);

  ngOnInit(): void {
    this.customTo = new Date().toISOString().split('T')[0];
    this.customFrom = this.subtractMonths(3);
    this.loadAll();
  }

  setRange(range: RangePreset): void {
    this.activeRange.set(range);
    this.loadAll();
  }

  applyCustomRange(): void {
    this.activeRange.set('custom');
    this.loadAll();
  }

  loadAll(): void {
    const { from, to } = this.getDateRange();
    this.loadCharts(from, to);
    this.loadGoals();
  }

  loadCharts(from: string, to: string): void {
    this.api.getHistory('waist', from, to).subscribe((data) => {
      this.waistChartData.set(this.buildLineChart(data, 'Cintura (cm)', '#4F46E5'));
    });

    this.api.getHistory('arm_right', from, to).subscribe((armR) => {
      this.api.getHistory('arm_left', from, to).subscribe((armL) => {
        const labels = armR.map((p) => this.formatLabel(p.date));
        this.armsChartData.set({
          labels,
          datasets: [
            { label: 'Brazo D', data: armR.map((p) => p.value), borderColor: '#10B981', tension: 0.3 },
            { label: 'Brazo I', data: armL.map((p) => p.value), borderColor: '#F59E0B', tension: 0.3 },
          ],
        });
      });
    });

    this.api.getHistory('weight', from, to).subscribe((data) => {
      this.weightChartData.set(this.buildLineChart(data, 'Peso (kg)', '#6366F1'));
    });

    this.api.getHistory('protein', from, to).subscribe((protein) => {
      this.api.getHistory('calories', from, to).subscribe((calories) => {
        const labels = protein.map((p) => this.formatLabel(p.date));
        this.nutritionChartData.set({
          labels,
          datasets: [
            { label: 'Proteína (g)', data: protein.map((p) => p.value), backgroundColor: '#4F46E5' },
            { label: 'Calorías /10', data: calories.map((p) => Math.round(p.value / 10)), backgroundColor: '#F59E0B' },
          ],
        });
      });
    });
  }

  loadGoals(): void {
    this.api.getAllGoalsProgress().subscribe((goals) => {
      this.goalsProgress.set(goals);

      const configs = goals.map((gp) => {
        const allDates = new Map<string, { actual: number | null; ideal: number | null }>();

        for (const pt of gp.ideal_line) {
          allDates.set(pt.date, { actual: null, ideal: pt.value });
        }

        for (const pt of gp.history) {
          const existing = allDates.get(pt.date);
          if (existing) {
            existing.actual = pt.actual;
          } else {
            allDates.set(pt.date, { actual: pt.actual, ideal: null });
          }
        }

        const sorted = [...allDates.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        const labels = sorted.map(([d]) => this.formatLabel(d));
        const idealValues = sorted.map(([, v]) => v.ideal);
        const actualValues = sorted.map(([, v]) => v.actual);

        const data: ChartConfiguration<'line'>['data'] = {
          labels,
          datasets: [
            {
              label: 'Real',
              data: actualValues as (number | null)[],
              borderColor: '#4F46E5',
              backgroundColor: 'rgba(79,70,229,0.08)',
              tension: 0,
              fill: true,
              spanGaps: true,
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 2,
            },
            {
              label: 'Ideal',
              data: idealValues as (number | null)[],
              borderColor: '#94A3B8',
              borderDash: [6, 4],
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 1.5,
              tension: 0,
              spanGaps: true,
            },
          ],
        };

        const options: ChartConfiguration<'line'>['options'] = {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex;
                  if (idx !== undefined) {
                    const dateStr = sorted[idx]?.[0];
                    if (dateStr) {
                      const d = new Date(dateStr + 'T12:00:00');
                      return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
                    }
                  }
                  return '';
                },
                label: (item) => {
                  const val = item.raw as number | null;
                  if (val === null) return '';
                  return `${item.dataset.label}: ${val} ${this.getUnit(gp.goal.metric)}`;
                },
              },
            },
            zoom: {
              zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
              pan: { enabled: true, mode: 'x' },
            },
          },
          scales: {
            y: { title: { display: true, text: this.getUnit(gp.goal.metric) } },
          },
        };
        return { goal: gp, data, options };
      });

      this.goalChartConfigs.set(configs);
    });
  }

  getDirectionLabel(direction: string): string {
    const labels: Record<string, string> = { decrease: '↓ Reducir', increase: '↑ Aumentar', maintain: '↔ Mantener' };
    return labels[direction] || direction;
  }

  getDirectionClass(gp: GoalProgress): string {
    if (gp.on_track) return 'on-track';
    return 'off-track';
  }

  getDiffLabel(gp: GoalProgress): string {
    if (gp.diff_from_ideal === 0) return 'En la línea ideal';
    const abs = Math.abs(gp.diff_from_ideal);
    if (gp.goal.direction === 'decrease') {
      return gp.diff_from_ideal > 0 ? `${abs} ${this.getUnit(gp.goal.metric)} arriba de lo ideal` : `${abs} ${this.getUnit(gp.goal.metric)} mejor que lo ideal`;
    }
    return gp.diff_from_ideal < 0 ? `${abs} ${this.getUnit(gp.goal.metric)} debajo de lo ideal` : `${abs} ${this.getUnit(gp.goal.metric)} mejor que lo ideal`;
  }

  private buildLineChart(data: HistoryPoint[], label: string, color: string): ChartConfiguration<'line'>['data'] {
    return {
      labels: data.map((p) => this.formatLabel(p.date)),
      datasets: [{
        label, data: data.map((p) => p.value),
        borderColor: color, backgroundColor: color + '1A', tension: 0.3, fill: true,
      }],
    };
  }

  private formatLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.toLocaleDateString('es-MX', { weekday: 'short' });
    const num = d.getDate();
    const month = d.toLocaleDateString('es-MX', { month: 'short' });
    return `${day} ${num} ${month}`;
  }

  private getUnit(metric: string): string {
    if (metric.includes('cm')) return 'cm';
    if (metric.includes('kg')) return 'kg';
    return '';
  }

  private getDateRange(): { from: string; to: string } {
    const to = new Date().toISOString().split('T')[0];
    const range = this.activeRange();
    if (range === 'custom') return { from: this.customFrom, to: this.customTo };
    if (range === 'all') return { from: '2020-01-01', to };
    if (range === '3m') return { from: this.subtractMonths(3), to };
    if (range === '6m') return { from: this.subtractMonths(6), to };
    if (range === '1y') return { from: this.subtractMonths(12), to };
    if (range === '2y') return { from: this.subtractMonths(24), to };
    return { from: '2020-01-01', to };
  }

  private subtractMonths(months: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d.toISOString().split('T')[0];
  }
}
