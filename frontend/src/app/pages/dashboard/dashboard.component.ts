import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { localToday, localDateString } from '../../utils/date';
import { DailySummary, GoalProgress, WeeklyReportCard, ProteinStreak, TrainingDay, SupplementStatus, DeficitEfficiency, WaistToHeightRatio } from '../../models';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);

  today = localToday();
  displayDate = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  summary = signal<DailySummary | null>(null);
  mainGoal = signal<GoalProgress | null>(null);
  allGoals = signal<GoalProgress[]>([]);
  reportCard = signal<WeeklyReportCard | null>(null);
  proteinStreak = signal<ProteinStreak | null>(null);
  trainingDay = signal<TrainingDay | null>(null);
  supplements = signal<SupplementStatus | null>(null);
  deficitEfficiency = signal<DeficitEfficiency | null>(null);
  whtr = signal<WaistToHeightRatio | null>(null);

  waistSparkData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  weightSparkData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  waistWeeklyData = signal<ChartConfiguration<'bar'>['data']>({ labels: [], datasets: [] });
  weightWeeklyData = signal<ChartConfiguration<'bar'>['data']>({ labels: [], datasets: [] });
  sparkOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true, callbacks: { label: (ctx) => `${ctx.raw}` } } },
    scales: {
      x: { display: true, ticks: { font: { size: 9 }, maxRotation: 0 } },
      y: { display: true, ticks: { font: { size: 9 } } },
    },
    elements: { point: { radius: 3, hoverRadius: 6 } },
  };
  barOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { ticks: { font: { size: 9 } } },
      y: { ticks: { font: { size: 9 } } },
    },
  };

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.api.getDailySummary(this.today).subscribe((s) => this.summary.set(s));
    this.api.getProteinStreak().subscribe((s) => this.proteinStreak.set(s));
    this.api.getTrainingToday().subscribe((t) => this.trainingDay.set(t));
    this.api.getSupplements(this.today).subscribe((s) => this.supplements.set(s));
    this.api.getDeficitEfficiency().subscribe((d) => this.deficitEfficiency.set(d));
    this.api.getWaistToHeightRatio().subscribe((w) => this.whtr.set(w));
    this.api.getAllGoalsProgress().subscribe((goals) => {
      this.allGoals.set(goals);
      const waistGoal = goals.find((g) => g.goal.metric === 'waist_cm');
      this.mainGoal.set(waistGoal || goals[0] || null);
    });

    const monday = this.getMonday();
    this.api.getWeeklyReport(monday).subscribe((r) => this.reportCard.set(r));

    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
    const from = localDateString(threeWeeksAgo);

    this.api.getHistory('waist', from, this.today).subscribe((data) => {
      this.waistSparkData.set(this.buildSpark(data, '#4F46E5'));
    });
    this.api.getHistory('weight', from, this.today).subscribe((data) => {
      this.weightSparkData.set(this.buildSpark(data, '#6366F1'));
    });

    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const weeklyFrom = localDateString(eightWeeksAgo);
    this.api.getWeeklyAverages(weeklyFrom, this.today).subscribe((weeks) => {
      const labels = weeks.map((w) => `Sem ${new Date(w.week_start + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`);
      this.waistWeeklyData.set({
        labels,
        datasets: [{ label: 'Cintura', data: weeks.map((w) => w.waist_cm), backgroundColor: '#4F46E5', borderRadius: 3 }],
      });
      this.weightWeeklyData.set({
        labels,
        datasets: [{ label: 'Peso', data: weeks.map((w) => w.weight_kg), backgroundColor: '#6366F1', borderRadius: 3 }],
      });
    });
  }

  toggleSupplement(type: 'creatine' | 'protein_powder'): void {
    const current = this.supplements();
    if (!current) return;
    const taken = type === 'creatine' ? !current.creatine : !current.protein_powder;
    this.api.toggleSupplement(this.today, type, taken).subscribe((s) => this.supplements.set(s));
  }

  getMacroPercent(current: number, max: number): number {
    return Math.min(Math.round((current / max) * 100), 100);
  }

  getMacroStatus(current: number, min: number, max: number): string {
    if (current >= min && current <= max) return 'on-target';
    if (current < min * 0.85) return 'low';
    if (current > max * 1.15) return 'high';
    return 'near';
  }

  getWeeklyRate(gp: GoalProgress): string {
    if (gp.history.length < 2) return '—';
    const first = gp.history[0];
    const last = gp.history[gp.history.length - 1];
    const weeks = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (7 * 24 * 60 * 60 * 1000);
    if (weeks < 0.5) return '—';
    const rate = Math.abs(last.actual - first.actual) / weeks;
    const unit = gp.goal.metric.includes('cm') ? 'cm' : 'kg';
    return `${Math.round(rate * 100) / 100} ${unit}/sem`;
  }

  getWhtrLabel(): string {
    const w = this.whtr();
    if (!w) return '';
    const labels: Record<string, string> = { excelente: '🟢 Excelente', saludable: '🟡 Saludable', aumentado: '🟠 Aumentado', riesgo_alto: '🔴 Alto' };
    return labels[w.category] || w.category;
  }

  private buildSpark(data: { date: string; value: number }[], color: string): ChartConfiguration<'line'>['data'] {
    const labels = data.map((p) => {
      const d = new Date(p.date + 'T12:00:00');
      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    });
    return {
      labels,
      datasets: [{ data: data.map((p) => p.value), borderColor: color, backgroundColor: color + '14', fill: true, tension: 0, borderWidth: 2, pointRadius: 3 }],
    };
  }

  private getMonday(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return localDateString(d);
  }
}
