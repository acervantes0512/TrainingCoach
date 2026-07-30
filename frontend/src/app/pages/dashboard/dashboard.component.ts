import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DailySummary, GoalProgress, WeeklyReportCard, ProteinStreak, TrainingDay, SupplementStatus } from '../../models';
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

  today = new Date().toISOString().split('T')[0];
  summary = signal<DailySummary | null>(null);
  mainGoal = signal<GoalProgress | null>(null);
  reportCard = signal<WeeklyReportCard | null>(null);
  proteinStreak = signal<ProteinStreak | null>(null);
  trainingDay = signal<TrainingDay | null>(null);
  supplements = signal<SupplementStatus | null>(null);

  sparkData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  sparkOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: { x: { display: false }, y: { display: false } },
    elements: { point: { radius: 2 } },
  };

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.api.getDailySummary(this.today).subscribe((s) => this.summary.set(s));
    this.api.getProteinStreak().subscribe((s) => this.proteinStreak.set(s));
    this.api.getTrainingToday().subscribe((t) => this.trainingDay.set(t));
    this.api.getSupplements(this.today).subscribe((s) => this.supplements.set(s));
    this.api.getAllGoalsProgress().subscribe((goals) => {
      const waistGoal = goals.find((g) => g.goal.metric === 'waist_cm');
      this.mainGoal.set(waistGoal || goals[0] || null);
    });

    const monday = this.getMonday(new Date());
    this.api.getWeeklyReport(monday).subscribe((r) => this.reportCard.set(r));

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const from = twoWeeksAgo.toISOString().split('T')[0];
    this.api.getHistory('waist', from, this.today).subscribe((data) => {
      this.sparkData.set({
        labels: data.map((p) => p.date),
        datasets: [{
          data: data.map((p) => p.value),
          borderColor: '#4F46E5',
          backgroundColor: 'rgba(79,70,229,0.08)',
          fill: true,
          tension: 0,
          borderWidth: 2,
        }],
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

  private getMonday(d: Date): string {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date.toISOString().split('T')[0];
  }
}
