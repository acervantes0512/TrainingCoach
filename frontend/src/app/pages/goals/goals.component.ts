import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Goal, GoalProgress, Milestone } from '../../models';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, Chart } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './goals.component.html',
  styleUrl: './goals.component.scss',
})
export class GoalsComponent implements OnInit {
  private api = inject(ApiService);

  goalsProgress = signal<GoalProgress[]>([]);
  milestones = signal<Milestone[]>([]);
  showForm = signal(false);

  newGoal = { metric: 'waist_cm', label: '', direction: 'decrease' as 'decrease' | 'increase' | 'maintain', target_value: 0, baseline_value: 0, start_date: '', target_date: '' };

  chartConfigs = signal<{ gp: GoalProgress; data: ChartConfiguration<'line'>['data']; options: ChartConfiguration<'line'>['options'] }[]>([]);

  ngOnInit(): void {
    this.loadGoals();
    this.api.getMilestones().subscribe((m) => this.milestones.set(m));
  }

  loadGoals(): void {
    this.api.getAllGoalsProgress().subscribe((goals) => {
      this.goalsProgress.set(goals);
      this.buildCharts(goals);
    });
  }

  createGoal(): void {
    const { metric, label, direction, target_value, baseline_value, start_date, target_date } = this.newGoal;
    if (!label || !start_date || !target_date) return;
    this.api.getGoals().subscribe(() => {
      const body = { metric, label, direction, target_value, baseline_value, start_date, target_date };
      this.api.createGoal(body).subscribe(() => { this.showForm.set(false); this.loadGoals(); });
    });
  }

  getDirectionLabel(d: string): string {
    return { decrease: '↓ Reducir', increase: '↑ Aumentar', maintain: '↔ Mantener' }[d] || d;
  }

  getMetricLabel(m: string): string {
    return { waist_cm: 'Cintura (cm)', weight_kg: 'Peso (kg)', arm_right_cm: 'Brazo D (cm)', arm_left_cm: 'Brazo I (cm)' }[m] || m;
  }

  getDiffText(gp: GoalProgress): string {
    if (gp.diff_from_ideal === 0) return 'En la línea ideal';
    const abs = Math.abs(gp.diff_from_ideal);
    const unit = gp.goal.metric.includes('cm') ? 'cm' : 'kg';
    if (gp.goal.direction === 'decrease') return gp.diff_from_ideal > 0 ? `${abs} ${unit} arriba del ideal` : `${abs} ${unit} mejor que el ideal`;
    return gp.diff_from_ideal < 0 ? `${abs} ${unit} debajo del ideal` : `${abs} ${unit} mejor que el ideal`;
  }

  getPrediction(gp: GoalProgress): string {
    if (!gp.current_value || gp.history.length < 2) return 'Datos insuficientes';
    const first = gp.history[0];
    const last = gp.history[gp.history.length - 1];
    const daysDiff = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (24 * 60 * 60 * 1000);
    if (daysDiff < 3) return 'Necesita más datos';
    const rate = (last.actual - first.actual) / daysDiff;
    if (gp.goal.direction === 'decrease' && rate >= 0) return 'Sin progreso — ajustar';
    if (gp.goal.direction === 'increase' && rate <= 0) return 'Sin progreso — ajustar';
    const remaining = gp.goal.target_value - last.actual;
    const daysToGoal = Math.abs(remaining / rate);
    const projectedDate = new Date(last.date);
    projectedDate.setDate(projectedDate.getDate() + daysToGoal);
    return `Proyección: ${projectedDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  private buildCharts(goals: GoalProgress[]): void {
    const configs = goals.map((gp) => {
      const allDates = new Map<string, { actual: number | null; ideal: number | null }>();
      for (const pt of gp.ideal_line) allDates.set(pt.date, { actual: null, ideal: pt.value });
      for (const pt of gp.history) {
        const ex = allDates.get(pt.date);
        if (ex) ex.actual = pt.actual; else allDates.set(pt.date, { actual: pt.actual, ideal: null });
      }
      const sorted = [...allDates.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      const labels = sorted.map(([d]) => { const dt = new Date(d + 'T12:00:00'); return dt.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }); });

      const data: ChartConfiguration<'line'>['data'] = {
        labels,
        datasets: [
          { label: 'Real', data: sorted.map(([, v]) => v.actual) as (number | null)[], borderColor: '#4F46E5', backgroundColor: 'rgba(79,70,229,0.08)', tension: 0, fill: true, spanGaps: true, pointRadius: 4, borderWidth: 2 },
          { label: 'Ideal', data: sorted.map(([, v]) => v.ideal) as (number | null)[], borderColor: '#94A3B8', borderDash: [6, 4], pointRadius: 0, tension: 0, spanGaps: true, borderWidth: 1.5 },
        ],
      };
      const options: ChartConfiguration<'line'>['options'] = {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' }, zoom: { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }, pan: { enabled: true, mode: 'x' } } },
        scales: { y: { title: { display: true, text: gp.goal.metric.includes('cm') ? 'cm' : 'kg' } } },
      };
      return { gp, data, options };
    });
    this.chartConfigs.set(configs);
  }
}
