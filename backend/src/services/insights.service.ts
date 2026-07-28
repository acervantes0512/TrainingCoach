import db from '../db/database.js';
import * as MeasurementService from './measurement.service.js';
import * as MealService from './meal.service.js';
import * as SettingsService from './settings.service.js';

export interface ProteinStreak {
  current_streak: number;
  longest_streak: number;
  floor: number;
}

export interface AdherenceDay {
  date: string;
  status: 'green' | 'yellow' | 'red' | 'none';
}

export interface Milestone {
  value: number;
  reached: boolean;
  date_reached: string | null;
}

export interface DeficitEfficiency {
  waist_lost_cm: number;
  weight_lost_kg: number;
  ratio: number | null;
  rating: 'excellent' | 'normal' | 'warning';
}

export interface ProteinDistribution {
  meal_type: string;
  label: string;
  protein_g: number;
  optimal: boolean;
}

export interface WeeklyReportCard {
  week_start: string;
  overall_grade: string;
  protein_grade: string;
  protein_days_hit: number;
  calories_grade: string;
  calories_days_hit: number;
  measurements_grade: string;
  measurements_days: number;
  waist_rate_grade: string;
  arms_preservation_grade: string;
  message: string;
}

export interface TrainingDay {
  day_of_week: number;
  muscle_group: string;
  label: string;
  emoji: string;
}

const TRAINING_SPLIT: TrainingDay[] = [
  { day_of_week: 1, muscle_group: 'pull', label: 'Jale — Espalda, bíceps', emoji: '🏋️' },
  { day_of_week: 2, muscle_group: 'push', label: 'Empuje — Pecho, tríceps, hombro', emoji: '💪' },
  { day_of_week: 3, muscle_group: 'legs', label: 'Pierna — Cuádriceps, femoral, glúteo', emoji: '🦵' },
  { day_of_week: 4, muscle_group: 'pull', label: 'Jale — Espalda, bíceps', emoji: '🏋️' },
  { day_of_week: 5, muscle_group: 'push', label: 'Empuje — Pecho, tríceps, hombro', emoji: '💪' },
];

const WAIST_MILESTONES = [100, 99, 98, 97, 96, 95, 94];

export async function getProteinStreak(): Promise<ProteinStreak> {
  const settings = await SettingsService.get();
  const floor = settings.protein_floor_g;

  const rows = await db.execute(
    `SELECT date, SUM(protein_g) as total_protein
     FROM meals GROUP BY date ORDER BY date DESC`
  );

  let currentStreak = 0;
  let longestStreak = 0;
  let counting = true;

  for (const row of rows.rows as unknown as { date: string; total_protein: number }[]) {
    if (row.total_protein >= floor) {
      if (counting) currentStreak++;
      longestStreak = Math.max(longestStreak, counting ? currentStreak : 0);
    } else {
      if (counting) counting = false;
    }
  }

  const allStreaks: number[] = [];
  let tempStreak = 0;
  const sortedRows = [...(rows.rows as unknown as { date: string; total_protein: number }[])].reverse();
  for (const row of sortedRows) {
    if (row.total_protein >= floor) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  return { current_streak: currentStreak, longest_streak: longestStreak, floor };
}

export async function getAdherenceCalendar(from: string, to: string): Promise<AdherenceDay[]> {
  const settings = await SettingsService.get();
  const days: AdherenceDay[] = [];

  const start = new Date(from + 'T12:00:00');
  const end = new Date(to + 'T12:00:00');

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      days.push({ date: dateStr, status: 'none' });
      continue;
    }

    const meals = await MealService.getByDate(dateStr);
    if (meals.length === 0) {
      days.push({ date: dateStr, status: 'none' });
      continue;
    }

    const totals = meals.reduce(
      (acc, m) => ({ protein: acc.protein + m.protein_g, calories: acc.calories + m.calories }),
      { protein: 0, calories: 0 }
    );

    const proteinOk = totals.protein >= settings.protein_floor_g;
    const caloriesOk = totals.calories >= settings.calories_min && totals.calories <= settings.calories_max;

    if (proteinOk && caloriesOk) days.push({ date: dateStr, status: 'green' });
    else if (proteinOk || caloriesOk) days.push({ date: dateStr, status: 'yellow' });
    else days.push({ date: dateStr, status: 'red' });
  }

  return days;
}

export async function getMilestones(): Promise<Milestone[]> {
  const measurements = await db.execute(
    'SELECT date, waist_cm FROM measurements ORDER BY date'
  );

  const rows = measurements.rows as unknown as { date: string; waist_cm: number }[];

  return WAIST_MILESTONES.map((threshold) => {
    const hit = rows.find((r) => r.waist_cm < threshold);
    return {
      value: threshold,
      reached: !!hit,
      date_reached: hit?.date || null,
    };
  });
}

export async function getDeficitEfficiency(): Promise<DeficitEfficiency> {
  const settings = await SettingsService.get();
  const latest = await MeasurementService.getLatest();

  if (!latest) {
    return { waist_lost_cm: 0, weight_lost_kg: 0, ratio: null, rating: 'normal' };
  }

  const waistLost = Math.round((settings.baseline_waist_cm - latest.waist_cm) * 100) / 100;
  const weightLost = Math.round((settings.initial_weight_kg - latest.weight_kg) * 100) / 100;

  let ratio: number | null = null;
  let rating: 'excellent' | 'normal' | 'warning' = 'normal';

  if (weightLost > 0.5) {
    ratio = Math.round((waistLost / weightLost) * 100) / 100;
    if (ratio > 0.8) rating = 'excellent';
    else if (ratio >= 0.4) rating = 'normal';
    else rating = 'warning';
  }

  return { waist_lost_cm: waistLost, weight_lost_kg: weightLost, ratio, rating };
}

export async function getProteinDistribution(date: string): Promise<ProteinDistribution[]> {
  const meals = await MealService.getByDate(date);
  const labels: Record<string, string> = {
    breakfast: 'Desayuno',
    lunch: 'Almuerzo',
    dinner: 'Cena',
    snack: 'Snack',
    shake: 'Batido',
  };

  const grouped: Record<string, number> = {};
  for (const meal of meals) {
    grouped[meal.meal_type] = (grouped[meal.meal_type] || 0) + meal.protein_g;
  }

  return Object.entries(grouped).map(([type, protein]) => ({
    meal_type: type,
    label: labels[type] || type,
    protein_g: Math.round(protein * 10) / 10,
    optimal: protein >= 25 && protein <= 55,
  }));
}

export async function getWaistToHeightRatio(heightCm?: number): Promise<{ ratio: number; category: string }> {
  const settings = await SettingsService.get();
  const latest = await MeasurementService.getLatest();
  const waist = latest?.waist_cm || settings.baseline_waist_cm;
  const height = heightCm || settings.height_cm;

  const ratio = Math.round((waist / height) * 1000) / 1000;

  let category = 'saludable';
  if (ratio > 0.6) category = 'riesgo_alto';
  else if (ratio > 0.53) category = 'aumentado';
  else if (ratio <= 0.46) category = 'excelente';

  return { ratio, category };
}

export function getTodayTraining(): TrainingDay | null {
  const dayOfWeek = new Date().getDay();
  return TRAINING_SPLIT.find((t) => t.day_of_week === dayOfWeek) || null;
}

export async function getWeeklyReport(weekStart: string): Promise<WeeklyReportCard> {
  const settings = await SettingsService.get();
  const dates: string[] = [];
  const start = new Date(weekStart + 'T12:00:00');
  for (let i = 0; i < 5; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  let proteinDaysHit = 0;
  let caloriesDaysHit = 0;
  let daysWithData = 0;

  for (const date of dates) {
    const meals = await MealService.getByDate(date);
    if (meals.length === 0) continue;
    daysWithData++;

    const totals = meals.reduce(
      (acc, m) => ({ protein: acc.protein + m.protein_g, calories: acc.calories + m.calories }),
      { protein: 0, calories: 0 }
    );

    if (totals.protein >= settings.protein_floor_g) proteinDaysHit++;
    if (totals.calories >= settings.calories_min && totals.calories <= settings.calories_max) caloriesDaysHit++;
  }

  const measurements = await MeasurementService.getRange(dates[0], dates[dates.length - 1]);
  const measurementsDays = measurements.length;

  const latest = await MeasurementService.getLatest();
  const currentWaist = latest?.waist_cm || settings.baseline_waist_cm;
  const baselineDate = new Date(settings.baseline_date + 'T12:00:00');
  const today = new Date();
  const weeksElapsed = (today.getTime() - baselineDate.getTime()) / (7 * 24 * 60 * 60 * 1000);
  const waistLost = settings.baseline_waist_cm - currentWaist;
  const rate = weeksElapsed > 0.5 ? waistLost / weeksElapsed : 0;
  const neededRate = 0.74;

  const firstMeasurement = measurements.length > 0 ? measurements[0] : null;
  const armsDelta = firstMeasurement && latest
    ? Math.abs(latest.arm_right_cm - firstMeasurement.arm_right_cm) + Math.abs(latest.arm_left_cm - firstMeasurement.arm_left_cm)
    : 0;

  function grade(score: number): string {
    if (score >= 0.95) return 'A+';
    if (score >= 0.85) return 'A';
    if (score >= 0.7) return 'B';
    if (score >= 0.5) return 'C';
    return 'D';
  }

  const maxDays = daysWithData || 5;
  const proteinGrade = grade(proteinDaysHit / maxDays);
  const caloriesGrade = grade(caloriesDaysHit / maxDays);
  const measurementsGrade = grade(measurementsDays / 5);
  const waistRateGrade = rate >= neededRate ? 'A' : rate >= neededRate * 0.7 ? 'B' : 'C';
  const armsGrade = armsDelta <= 0.3 ? 'A+' : armsDelta <= 0.6 ? 'A' : armsDelta <= 1 ? 'B' : 'C';

  const grades = [proteinGrade, caloriesGrade, measurementsGrade, waistRateGrade, armsGrade];
  const gradeValues: Record<string, number> = { 'A+': 4.3, 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
  const avgGrade = grades.reduce((s, g) => s + (gradeValues[g] || 2), 0) / grades.length;

  let overallGrade = 'C';
  if (avgGrade >= 4.1) overallGrade = 'A+';
  else if (avgGrade >= 3.7) overallGrade = 'A';
  else if (avgGrade >= 3.3) overallGrade = 'A-';
  else if (avgGrade >= 2.7) overallGrade = 'B';
  else if (avgGrade >= 2.0) overallGrade = 'C';

  const diff = rate - neededRate;
  let message = '';
  if (diff >= 0.1) message = '¡Vas adelantado! Mantén el ritmo actual.';
  else if (diff >= 0) message = 'Estás justo en la meta. Consistencia es clave.';
  else if (diff >= -0.1) message = 'Ligeramente por debajo. Revisa adherencia a calorías.';
  else message = 'Necesitas ajustar. Evalúa si hay días fuera de rango.';

  return {
    week_start: weekStart,
    overall_grade: overallGrade,
    protein_grade: proteinGrade,
    protein_days_hit: proteinDaysHit,
    calories_grade: caloriesGrade,
    calories_days_hit: caloriesDaysHit,
    measurements_grade: measurementsGrade,
    measurements_days: measurementsDays,
    waist_rate_grade: waistRateGrade,
    arms_preservation_grade: armsGrade,
    message,
  };
}
