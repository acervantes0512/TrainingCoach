import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { MacroBarComponent } from '../../components/macro-bar/macro-bar.component';
import { MacroProgress, HistoryPoint } from '../../models';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-trends',
  standalone: true,
  imports: [CommonModule, MacroBarComponent, BaseChartDirective],
  templateUrl: './trends.component.html',
  styleUrl: './trends.component.scss',
})
export class TrendsComponent implements OnInit {
  private api = inject(ApiService);

  proteinAlert = signal(false);
  weeklyNutrition = signal<MacroProgress[]>([]);

  proteinChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  proteinChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { title: { display: true, text: 'g' }, suggestedMin: 100, suggestedMax: 200 },
    },
  };

  ngOnInit(): void {
    this.loadTrends();
  }

  loadTrends(): void {
    const baselineDate = '2026-07-27';
    const today = new Date().toISOString().split('T')[0];

    this.api.getHistory('protein', baselineDate, today).subscribe((data) => {
      const labels = data.map((p) => this.formatDate(p.date));
      const values = data.map((p) => p.value);

      const belowFloor = values.filter((v) => v < 140).length;
      this.proteinAlert.set(belowFloor > 0);

      this.proteinChartData.set({
        labels,
        datasets: [
          {
            label: 'Proteína Diaria',
            data: values,
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            tension: 0.3,
            fill: true,
          },
        ],
      });
    });

    const monday = this.getMonday(new Date());
    this.api.getWeeklySummary(monday).subscribe((summary) => {
      const avg = summary.nutrition_avg;
      this.weeklyNutrition.set([
        { label: 'Prom. Calorías', current: avg.calories, min: 2100, max: 2300, status: this.getStatus(avg.calories, 2100, 2300) },
        { label: 'Prom. Proteína', current: avg.protein_g, min: 150, max: 170, status: this.getStatus(avg.protein_g, 150, 170, 140) },
        { label: 'Prom. Carbos', current: avg.carbs_g, min: 180, max: 220, status: this.getStatus(avg.carbs_g, 180, 220) },
        { label: 'Prom. Grasa', current: avg.fat_g, min: 60, max: 70, status: this.getStatus(avg.fat_g, 60, 70) },
      ]);
    });
  }

  private getStatus(value: number, min: number, max: number, floor?: number): 'green' | 'amber' | 'red' {
    if (floor !== undefined && value < floor) return 'red';
    if (value >= min && value <= max) return 'green';
    const range = max - min;
    const tolerance = range * 0.5;
    if (value >= min - tolerance && value <= max + tolerance) return 'amber';
    return 'red';
  }

  private formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
  }

  private getMonday(d: Date): string {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date.toISOString().split('T')[0];
  }
}
