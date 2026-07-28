import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { WeeklySummary, HistoryPoint, GoalProgress, AdherenceDay, Milestone, DeficitEfficiency, WaistToHeightRatio, WeeklyReportCard } from '../../models';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-weekly',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './weekly.component.html',
  styleUrl: './weekly.component.scss',
})
export class WeeklyComponent implements OnInit {
  private api = inject(ApiService);

  weekStart = signal(this.getMonday(new Date()));
  summary = signal<WeeklySummary | null>(null);
  progress = signal<GoalProgress | null>(null);
  adherence = signal<AdherenceDay[]>([]);
  milestones = signal<Milestone[]>([]);
  deficitEfficiency = signal<DeficitEfficiency | null>(null);
  whtr = signal<WaistToHeightRatio | null>(null);
  reportCard = signal<WeeklyReportCard | null>(null);
  progressPercent = signal(0);

  waistChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  waistChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { title: { display: true, text: 'cm' }, suggestedMin: 92, suggestedMax: 102 } },
  };

  armsChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  armsChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { title: { display: true, text: 'cm' } } },
  };

  weightChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  weightChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { title: { display: true, text: 'kg' } } },
  };

  nutritionChartData = signal<ChartConfiguration<'bar'>['data']>({ labels: [], datasets: [] });
  nutritionChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { title: { display: true, text: 'g / kcal' } } },
  };

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.api.getWeeklySummary(this.weekStart()).subscribe((data) => this.summary.set(data));
    this.api.getGoalProgress().subscribe((data) => {
      this.progress.set(data);
      if (data) {
        const total = data.current_waist_cm - data.goal_waist_cm + data.remaining_cm;
        const lost = total - data.remaining_cm;
        this.progressPercent.set(Math.round((lost / total) * 100));
      }
    });
    this.loadCharts();
    this.loadInsights();
  }

  loadInsights(): void {
    const weekEnd = new Date(this.weekStart() + 'T12:00:00');
    weekEnd.setDate(weekEnd.getDate() + 6);
    const endStr = weekEnd.toISOString().split('T')[0];

    const fourWeeksAgo = new Date(this.weekStart() + 'T12:00:00');
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fromStr = fourWeeksAgo.toISOString().split('T')[0];

    this.api.getAdherence(fromStr, endStr).subscribe((data) => this.adherence.set(data));
    this.api.getMilestones().subscribe((data) => this.milestones.set(data));
    this.api.getDeficitEfficiency().subscribe((data) => this.deficitEfficiency.set(data));
    this.api.getWaistToHeightRatio().subscribe((data) => this.whtr.set(data));
    this.api.getWeeklyReport(this.weekStart()).subscribe((data) => this.reportCard.set(data));
  }

  loadCharts(): void {
    const baselineDate = '2026-07-27';
    const today = new Date().toISOString().split('T')[0];

    this.api.getHistory('waist', baselineDate, today).subscribe((history) => {
      const labels = history.map((p) => this.formatShortDate(p.date));
      const actual = history.map((p) => p.value);
      const targetLine = this.generateTargetLine(history.length, 100.5, 94);

      this.waistChartData.set({
        labels,
        datasets: [
          { label: 'Real', data: actual, borderColor: '#4F46E5', backgroundColor: 'rgba(79, 70, 229, 0.1)', tension: 0.3, fill: true },
          { label: 'Meta', data: targetLine, borderColor: '#94A3B8', borderDash: [6, 4], pointRadius: 0 },
        ],
      });
    });

    this.api.getHistory('arm_right', baselineDate, today).subscribe((armR) => {
      this.api.getHistory('arm_left', baselineDate, today).subscribe((armL) => {
        const labels = armR.map((p) => this.formatShortDate(p.date));
        this.armsChartData.set({
          labels,
          datasets: [
            { label: 'Derecho', data: armR.map((p) => p.value), borderColor: '#10B981', tension: 0.3 },
            { label: 'Izquierdo', data: armL.map((p) => p.value), borderColor: '#F59E0B', tension: 0.3 },
          ],
        });
      });
    });

    this.api.getHistory('weight', baselineDate, today).subscribe((history) => {
      this.weightChartData.set({
        labels: history.map((p) => this.formatShortDate(p.date)),
        datasets: [
          { label: 'Peso', data: history.map((p) => p.value), borderColor: '#6366F1', backgroundColor: 'rgba(99, 102, 241, 0.1)', tension: 0.3, fill: true },
        ],
      });
    });

    this.api.getHistory('protein', baselineDate, today).subscribe((protein) => {
      this.api.getHistory('calories', baselineDate, today).subscribe((calories) => {
        const labels = protein.map((p) => this.formatShortDate(p.date));
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

  prevWeek(): void {
    const d = new Date(this.weekStart() + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    this.weekStart.set(d.toISOString().split('T')[0]);
    this.loadData();
  }

  nextWeek(): void {
    const d = new Date(this.weekStart() + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    this.weekStart.set(d.toISOString().split('T')[0]);
    this.loadData();
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      on_track: '✅ En Ritmo',
      needs_adjustment: '⚠️ Necesita Ajuste',
      behind: '🔴 Atrasado',
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      on_track: 'status-green',
      needs_adjustment: 'status-amber',
      behind: 'status-red',
    };
    return classes[status] || '';
  }

  getWhtrLabel(category: string): string {
    const labels: Record<string, string> = {
      excelente: '🟢 Excelente',
      saludable: '🟡 Saludable',
      aumentado: '🟠 Riesgo Aumentado',
      riesgo_alto: '🔴 Riesgo Alto',
    };
    return labels[category] || category;
  }

  getGradeColor(grade: string): string {
    if (grade.startsWith('A')) return 'var(--color-success)';
    if (grade === 'B') return 'var(--color-warning)';
    return 'var(--color-danger)';
  }

  private getMonday(d: Date): string {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date.toISOString().split('T')[0];
  }

  private formatShortDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
  }

  private generateTargetLine(points: number, start: number, end: number): number[] {
    if (points <= 1) return [start];
    const step = (end - start) / (points - 1);
    return Array.from({ length: points }, (_, i) => Math.round((start + step * i) * 100) / 100);
  }
}
