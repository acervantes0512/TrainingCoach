import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Goal, GoalProgress, Milestone } from '../../models';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, Chart } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

type ViewMode = 'daily' | 'weekly' | 'summary';

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './goals.component.html',
  styleUrl: './goals.component.scss',
})
export class GoalsComponent implements OnInit {
  private api = inject(ApiService);

  allGoals = signal<GoalProgress[]>([]);
  milestones = signal<Milestone[]>([]);
  viewMode = signal<ViewMode>('daily');
  selectedGoalId = signal<number | null>(null);
  showForm = signal(false);

  newGoal = { metric: 'waist_cm', label: '', direction: 'decrease' as 'decrease' | 'increase' | 'maintain', target_value: 0, baseline_value: 0, start_date: '', target_date: '' };

  selectedGoal = computed(() => {
    const id = this.selectedGoalId();
    const goals = this.allGoals();
    if (id === null && goals.length > 0) return goals[0];
    return goals.find((g) => g.goal.id === id) || null;
  });

  dailyChartData = computed(() => this.buildDailyChart(this.selectedGoal()));
  dailyChartOptions = computed(() => this.buildDailyOptions(this.selectedGoal()));
  weeklyChartData = computed(() => this.buildWeeklyChart(this.selectedGoal()));
  weeklyChartOptions = computed(() => this.buildWeeklyOptions(this.selectedGoal()));
  weeklyLineData = computed(() => this.buildWeeklyLineChart(this.selectedGoal()));
  weeklyLineOptions = computed(() => this.buildDailyOptions(this.selectedGoal()));

  ngOnInit(): void {
    this.loadGoals();
    this.api.getMilestones().subscribe((m) => this.milestones.set(m));
  }

  loadGoals(): void {
    this.api.getAllGoalsProgress().subscribe((goals) => {
      this.allGoals.set(goals);
      if (goals.length > 0 && this.selectedGoalId() === null) {
        this.selectedGoalId.set(goals[0].goal.id);
      }
    });
  }

  selectGoal(id: number): void {
    this.selectedGoalId.set(id);
  }

  setView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  createGoal(): void {
    const { metric, label, direction, target_value, baseline_value, start_date, target_date } = this.newGoal;
    if (!label || !start_date || !target_date) return;
    const body = { metric, label, direction, target_value, baseline_value, start_date, target_date };
    this.api.createGoal(body).subscribe(() => { this.showForm.set(false); this.loadGoals(); });
  }

  getDirectionLabel(d: string): string {
    return { decrease: '↓ Reducir', increase: '↑ Aumentar', maintain: '↔ Mantener' }[d] || d;
  }

  getMetricLabel(m: string): string {
    return { waist_cm: 'Cintura', weight_kg: 'Peso', arm_right_cm: 'Brazo D', arm_left_cm: 'Brazo I' }[m] || m;
  }

  getUnit(metric: string): string {
    return metric.includes('cm') ? 'cm' : 'kg';
  }

  getDiffText(gp: GoalProgress): string {
    if (gp.diff_from_ideal === 0) return 'En la línea ideal';
    const abs = Math.abs(gp.diff_from_ideal);
    const unit = this.getUnit(gp.goal.metric);
    if (gp.goal.direction === 'decrease') return gp.diff_from_ideal > 0 ? `${abs} ${unit} arriba del ideal` : `${abs} ${unit} mejor que el ideal`;
    return gp.diff_from_ideal < 0 ? `${abs} ${unit} debajo del ideal` : `${abs} ${unit} mejor que el ideal`;
  }

  getWeeklyRate(gp: GoalProgress): string {
    if (gp.history.length < 2) return '—';
    const first = gp.history[0];
    const last = gp.history[gp.history.length - 1];
    const weeks = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (7 * 24 * 60 * 60 * 1000);
    if (weeks < 0.5) return '—';
    const rate = Math.abs(last.actual - first.actual) / weeks;
    return `${Math.round(rate * 100) / 100} ${this.getUnit(gp.goal.metric)}/sem`;
  }

  getNeededRate(gp: GoalProgress): string {
    const remaining = Math.abs(gp.goal.target_value - (gp.current_value || gp.goal.baseline_value));
    const endDate = new Date(gp.goal.target_date + 'T12:00:00');
    const weeksLeft = (endDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000);
    if (weeksLeft <= 0) return 'Vencida';
    const rate = remaining / weeksLeft;
    return `${Math.round(rate * 100) / 100} ${this.getUnit(gp.goal.metric)}/sem`;
  }

  getWeeksLeft(gp: GoalProgress): number {
    const endDate = new Date(gp.goal.target_date + 'T12:00:00');
    return Math.max(0, Math.round((endDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)));
  }

  getPrediction(gp: GoalProgress): string {
    if (!gp.current_value || gp.history.length < 2) return '—';
    const first = gp.history[0];
    const last = gp.history[gp.history.length - 1];
    const daysDiff = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (24 * 60 * 60 * 1000);
    if (daysDiff < 3) return '—';
    const rate = (last.actual - first.actual) / daysDiff;
    if (gp.goal.direction === 'decrease' && rate >= 0) return '⚠️ Sin progreso';
    if (gp.goal.direction === 'increase' && rate <= 0) return '⚠️ Sin progreso';
    const remaining = gp.goal.target_value - last.actual;
    const daysToGoal = Math.abs(remaining / rate);
    const projectedDate = new Date(last.date);
    projectedDate.setDate(projectedDate.getDate() + daysToGoal);
    const targetDate = new Date(gp.goal.target_date + 'T12:00:00');
    const onTime = projectedDate <= targetDate;
    return `${onTime ? '✓' : '⚠️'} ${projectedDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  private buildDailyChart(gp: GoalProgress | null): ChartConfiguration<'line'>['data'] {
    if (!gp) return { labels: [], datasets: [] };
    const allDates = new Map<string, { actual: number | null; ideal: number | null }>();
    for (const pt of gp.ideal_line) allDates.set(pt.date, { actual: null, ideal: pt.value });
    for (const pt of gp.history) {
      const ex = allDates.get(pt.date);
      if (ex) ex.actual = pt.actual; else allDates.set(pt.date, { actual: pt.actual, ideal: null });
    }
    const sorted = [...allDates.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return {
      labels: sorted.map(([d]) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })),
      datasets: [
        { label: 'Real (diario)', data: sorted.map(([, v]) => v.actual) as (number | null)[], borderColor: '#4F46E5', backgroundColor: 'rgba(79,70,229,0.08)', tension: 0, fill: true, spanGaps: true, pointRadius: 4, borderWidth: 2 },
        { label: 'Línea ideal', data: sorted.map(([, v]) => v.ideal) as (number | null)[], borderColor: '#94A3B8', borderDash: [6, 4], pointRadius: 0, tension: 0, spanGaps: true, borderWidth: 1.5 },
      ],
    };
  }

  private buildDailyOptions(gp: GoalProgress | null): ChartConfiguration<'line'>['options'] {
    return {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' }, zoom: { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }, pan: { enabled: true, mode: 'x' } } },
      scales: { y: { title: { display: true, text: gp ? this.getUnit(gp.goal.metric) : '' } } },
    };
  }

  private buildWeeklyChart(gp: GoalProgress | null): ChartConfiguration<'bar'>['data'] {
    if (!gp || !gp.weekly_averages.length) return { labels: [], datasets: [] };
    return {
      labels: gp.weekly_averages.map((w) => `Sem ${new Date(w.week_start + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`),
      datasets: [
        { label: 'Promedio Real', data: gp.weekly_averages.map((w) => w.actual_avg), backgroundColor: '#4F46E5', borderRadius: 4 },
        { label: 'Promedio Ideal', data: gp.weekly_averages.map((w) => w.ideal_avg), backgroundColor: '#E2E8F0', borderRadius: 4 },
      ],
    };
  }

  private buildWeeklyLineChart(gp: GoalProgress | null): ChartConfiguration<'line'>['data'] {
    if (!gp || !gp.weekly_averages.length) return { labels: [], datasets: [] };
    const labels = gp.weekly_averages.map((w) => `Sem ${new Date(w.week_start + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`);
    return {
      labels,
      datasets: [
        { label: 'Prom. Real', data: gp.weekly_averages.map((w) => w.actual_avg), borderColor: '#4F46E5', backgroundColor: 'rgba(79,70,229,0.08)', tension: 0, fill: true, pointRadius: 5, borderWidth: 2.5, pointHoverRadius: 7 },
        { label: 'Prom. Ideal', data: gp.weekly_averages.map((w) => w.ideal_avg), borderColor: '#94A3B8', borderDash: [6, 4], pointRadius: 0, tension: 0, borderWidth: 1.5 },
      ],
    };
  }

  private buildWeeklyOptions(gp: GoalProgress | null): ChartConfiguration<'bar'>['options'] {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { title: { display: true, text: gp ? this.getUnit(gp.goal.metric) : '' } } },
    };
  }
}
