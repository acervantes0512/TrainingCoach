import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Measurement,
  MeasurementInput,
  Meal,
  MealInput,
  Settings,
  DailySummary,
  WeeklySummary,
  HistoryPoint,
  GoalProgress as SummaryGoalProgress,
  ProteinStreak,
  AdherenceDay,
  Milestone,
  DeficitEfficiency,
  ProteinDistribution,
  WaistToHeightRatio,
  TrainingDay,
  WeeklyReportCard,
  SupplementStatus,
  Goal,
  GoalProgress,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  getMeasurement(date: string): Observable<Measurement> {
    return this.http.get<Measurement>(`${this.baseUrl}/measurements/${date}`);
  }

  saveMeasurement(data: MeasurementInput): Observable<Measurement> {
    return this.http.post<Measurement>(`${this.baseUrl}/measurements`, data);
  }

  getMeals(date: string): Observable<Meal[]> {
    return this.http.get<Meal[]>(`${this.baseUrl}/meals`, { params: { date } });
  }

  createMeal(data: MealInput): Observable<Meal> {
    return this.http.post<Meal>(`${this.baseUrl}/meals`, data);
  }

  updateMeal(id: number, data: Partial<MealInput>): Observable<Meal> {
    return this.http.put<Meal>(`${this.baseUrl}/meals/${id}`, data);
  }

  deleteMeal(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/meals/${id}`);
  }

  getSettings(): Observable<Settings> {
    return this.http.get<Settings>(`${this.baseUrl}/settings`);
  }

  getDailySummary(date: string): Observable<DailySummary> {
    return this.http.get<DailySummary>(`${this.baseUrl}/summary/daily/${date}`);
  }

  getWeeklySummary(weekStart: string): Observable<WeeklySummary> {
    return this.http.get<WeeklySummary>(`${this.baseUrl}/summary/weekly/${weekStart}`);
  }

  getHistory(metric: string, from: string, to: string): Observable<HistoryPoint[]> {
    return this.http.get<HistoryPoint[]>(`${this.baseUrl}/summary/history`, {
      params: { metric, from, to },
    });
  }

  getGoalProgress(): Observable<SummaryGoalProgress> {
    return this.http.get<SummaryGoalProgress>(`${this.baseUrl}/summary/progress`);
  }

  getGoals(): Observable<Goal[]> {
    return this.http.get<Goal[]>(`${this.baseUrl}/goals/active`);
  }

  getAllGoalsProgress(): Observable<GoalProgress[]> {
    return this.http.get<GoalProgress[]>(`${this.baseUrl}/goals/progress`);
  }

  getProteinStreak(): Observable<ProteinStreak> {
    return this.http.get<ProteinStreak>(`${this.baseUrl}/insights/protein-streak`);
  }

  getAdherence(from: string, to: string): Observable<AdherenceDay[]> {
    return this.http.get<AdherenceDay[]>(`${this.baseUrl}/insights/adherence`, { params: { from, to } });
  }

  getMilestones(): Observable<Milestone[]> {
    return this.http.get<Milestone[]>(`${this.baseUrl}/insights/milestones`);
  }

  getDeficitEfficiency(): Observable<DeficitEfficiency> {
    return this.http.get<DeficitEfficiency>(`${this.baseUrl}/insights/deficit-efficiency`);
  }

  getProteinDistribution(date: string): Observable<ProteinDistribution[]> {
    return this.http.get<ProteinDistribution[]>(`${this.baseUrl}/insights/protein-distribution/${date}`);
  }

  getWaistToHeightRatio(): Observable<WaistToHeightRatio> {
    return this.http.get<WaistToHeightRatio>(`${this.baseUrl}/insights/whtr`);
  }

  getTrainingToday(): Observable<TrainingDay | null> {
    return this.http.get<TrainingDay | null>(`${this.baseUrl}/insights/training-today`);
  }

  getWeeklyReport(weekStart: string): Observable<WeeklyReportCard> {
    return this.http.get<WeeklyReportCard>(`${this.baseUrl}/insights/weekly-report/${weekStart}`);
  }

  getSupplements(date: string): Observable<SupplementStatus> {
    return this.http.get<SupplementStatus>(`${this.baseUrl}/supplements/${date}`);
  }

  toggleSupplement(date: string, supplementType: 'creatine' | 'protein_powder', taken: boolean): Observable<SupplementStatus> {
    return this.http.post<SupplementStatus>(`${this.baseUrl}/supplements/toggle`, {
      date,
      supplement_type: supplementType,
      taken,
    });
  }
}
