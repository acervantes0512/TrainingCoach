import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { ApiService } from '../../services/api.service';
import { Measurement, MeasurementInput, HistoryPoint, DeficitEfficiency, WaistToHeightRatio } from '../../models';

type RangePreset = '1m' | '3m' | '6m' | '1y' | 'all';

@Component({
  selector: 'app-measurements',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective, RouterLink],
  templateUrl: './measurements.component.html',
  styleUrl: './measurements.component.scss',
})
export class MeasurementsComponent implements OnInit {
  private api = inject(ApiService);

  activeRange = signal<RangePreset>('3m');
  editingId = signal<number | null>(null);

  form: MeasurementInput = {
    date: new Date().toISOString().split('T')[0],
    waist_cm: 0,
    arm_right_cm: 0,
    arm_left_cm: 0,
    weight_kg: 0,
  };

  measurements = signal<HistoryPoint[]>([]);
  deficitEfficiency = signal<DeficitEfficiency | null>(null);
  whtr = signal<WaistToHeightRatio | null>(null);

  waistChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  armsChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  weightChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  whtrChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });

  lineOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
  };

  ngOnInit(): void {
    this.loadCharts();
    this.loadIndicators();
  }

  setRange(range: RangePreset): void {
    this.activeRange.set(range);
    this.loadCharts();
  }

  saveMeasurement(): void {
    this.api.saveMeasurement(this.form).subscribe(() => {
      this.loadCharts();
      this.loadIndicators();
      this.form = {
        date: new Date().toISOString().split('T')[0],
        waist_cm: 0,
        arm_right_cm: 0,
        arm_left_cm: 0,
        weight_kg: 0,
      };
    });
  }

  loadCharts(): void {
    const { from, to } = this.getDateRange();

    this.api.getHistory('waist', from, to).subscribe((data) => {
      this.measurements.set(data);
      this.waistChartData.set(this.buildLineChart(data, 'Cintura (cm)', '#4F46E5'));
    });

    this.api.getHistory('arm_right', from, to).subscribe((armR) => {
      this.api.getHistory('arm_left', from, to).subscribe((armL) => {
        const labels = armR.map((p) => this.formatLabel(p.date));
        this.armsChartData.set({
          labels,
          datasets: [
            { label: 'Brazo D', data: armR.map((p) => p.value), borderColor: '#10B981', tension: 0, pointRadius: 3 },
            { label: 'Brazo I', data: armL.map((p) => p.value), borderColor: '#F59E0B', tension: 0, pointRadius: 3 },
          ],
        });
      });
    });

    this.api.getHistory('weight', from, to).subscribe((data) => {
      this.weightChartData.set(this.buildLineChart(data, 'Peso (kg)', '#6366F1'));
    });

    this.api.getHistory('whtr', from, to).subscribe((data) => {
      this.whtrChartData.set(this.buildLineChart(data, 'WHtR', '#EF4444'));
    });
  }

  formatLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.toLocaleDateString('es-MX', { weekday: 'short' });
    const num = d.getDate();
    const month = d.toLocaleDateString('es-MX', { month: 'short' });
    return `${day} ${num} ${month}`;
  }

  private loadIndicators(): void {
    this.api.getDeficitEfficiency().subscribe((data) => this.deficitEfficiency.set(data));
    this.api.getWaistToHeightRatio().subscribe((data) => this.whtr.set(data));
  }

  private buildLineChart(data: HistoryPoint[], label: string, color: string): ChartConfiguration<'line'>['data'] {
    return {
      labels: data.map((p) => this.formatLabel(p.date)),
      datasets: [{
        label,
        data: data.map((p) => p.value),
        borderColor: color,
        backgroundColor: color + '1A',
        tension: 0,
        fill: true,
        pointRadius: 3,
      }],
    };
  }

  private getDateRange(): { from: string; to: string } {
    const to = new Date().toISOString().split('T')[0];
    const range = this.activeRange();
    if (range === 'all') return { from: '2020-01-01', to };
    if (range === '1m') return { from: this.subtractMonths(1), to };
    if (range === '3m') return { from: this.subtractMonths(3), to };
    if (range === '6m') return { from: this.subtractMonths(6), to };
    if (range === '1y') return { from: this.subtractMonths(12), to };
    return { from: '2020-01-01', to };
  }

  private subtractMonths(months: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d.toISOString().split('T')[0];
  }
}
