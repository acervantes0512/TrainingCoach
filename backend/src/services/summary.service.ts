import db from '../db/database.js';
import * as MeasurementService from './measurement.service.js';
import * as MealService from './meal.service.js';
import * as SettingsService from './settings.service.js';
import {
  DailySummary,
  WeeklySummary,
  HistoryPoint,
  GoalProgress,
  MacroProgress,
  MacroStatus,
  Meal,
} from '../types.js';

function getMacroStatus(value: number, min: number, max: number, hardFloor?: number): MacroStatus {
  if (hardFloor !== undefined && value < hardFloor) return 'red';
  if (value >= min && value <= max) return 'green';
  const range = max - min;
  const tolerance = range * 0.5;
  if (value >= min - tolerance && value <= max + tolerance) return 'amber';
  return 'red';
}

export async function getDailySummary(date: string): Promise<DailySummary> {
  const settings = await SettingsService.get();
  const measurement = (await MeasurementService.getByDate(date)) || null;
  const meals = await MealService.getByDate(date);

  const totals = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein_g: acc.protein_g + meal.protein_g,
      carbs_g: acc.carbs_g + meal.carbs_g,
      fat_g: acc.fat_g + meal.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const macros: MacroProgress[] = [
    {
      label: 'Calorías',
      current: Math.round(totals.calories),
      min: settings.calories_min,
      max: settings.calories_max,
      status: getMacroStatus(totals.calories, settings.calories_min, settings.calories_max),
    },
    {
      label: 'Proteína',
      current: Math.round(totals.protein_g),
      min: settings.protein_min_g,
      max: settings.protein_max_g,
      status: getMacroStatus(totals.protein_g, settings.protein_min_g, settings.protein_max_g, settings.protein_floor_g),
    },
    {
      label: 'Carbohidratos',
      current: Math.round(totals.carbs_g),
      min: settings.carbs_min_g,
      max: settings.carbs_max_g,
      status: getMacroStatus(totals.carbs_g, settings.carbs_min_g, settings.carbs_max_g),
    },
    {
      label: 'Grasa',
      current: Math.round(totals.fat_g),
      min: settings.fat_min_g,
      max: settings.fat_max_g,
      status: getMacroStatus(totals.fat_g, settings.fat_min_g, settings.fat_max_g),
    },
  ];

  return { date, measurement, meals, totals, macros };
}

function getWeekDates(weekStart: string): string[] {
  const dates: string[] = [];
  const start = new Date(weekStart + 'T12:00:00');
  for (let i = 0; i < 5; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getPreviousWeekStart(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00');
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

export async function getWeeklySummary(weekStart: string): Promise<WeeklySummary> {
  const dates = getWeekDates(weekStart);
  const weekEnd = dates[dates.length - 1];

  const measurements = await MeasurementService.getRange(weekStart, weekEnd);

  let measurementAvg = null;
  if (measurements.length > 0) {
    measurementAvg = {
      waist_cm: Math.round((measurements.reduce((s, m) => s + m.waist_cm, 0) / measurements.length) * 100) / 100,
      arm_right_cm: Math.round((measurements.reduce((s, m) => s + m.arm_right_cm, 0) / measurements.length) * 100) / 100,
      arm_left_cm: Math.round((measurements.reduce((s, m) => s + m.arm_left_cm, 0) / measurements.length) * 100) / 100,
      weight_kg: Math.round((measurements.reduce((s, m) => s + m.weight_kg, 0) / measurements.length) * 100) / 100,
      days_measured: measurements.length,
    };
  }

  const allMeals: Meal[] = [];
  const daysWithMeals = new Set<string>();
  for (const date of dates) {
    const meals = await MealService.getByDate(date);
    if (meals.length > 0) {
      daysWithMeals.add(date);
      allMeals.push(...meals);
    }
  }

  const mealTotals = allMeals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein_g: acc.protein_g + meal.protein_g,
      carbs_g: acc.carbs_g + meal.carbs_g,
      fat_g: acc.fat_g + meal.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const daysLogged = daysWithMeals.size || 1;
  const nutritionAvg = {
    calories: Math.round(mealTotals.calories / daysLogged),
    protein_g: Math.round(mealTotals.protein_g / daysLogged),
    carbs_g: Math.round(mealTotals.carbs_g / daysLogged),
    fat_g: Math.round(mealTotals.fat_g / daysLogged),
    days_logged: daysWithMeals.size,
  };

  const prevStart = getPreviousWeekStart(weekStart);
  const prevDates = getWeekDates(prevStart);
  const prevEnd = prevDates[prevDates.length - 1];
  const prevMeasurements = await MeasurementService.getRange(prevStart, prevEnd);

  let previousWeekAvg = null;
  let deltas = null;
  if (prevMeasurements.length > 0) {
    previousWeekAvg = {
      waist_cm: Math.round((prevMeasurements.reduce((s, m) => s + m.waist_cm, 0) / prevMeasurements.length) * 100) / 100,
      arm_right_cm: Math.round((prevMeasurements.reduce((s, m) => s + m.arm_right_cm, 0) / prevMeasurements.length) * 100) / 100,
      arm_left_cm: Math.round((prevMeasurements.reduce((s, m) => s + m.arm_left_cm, 0) / prevMeasurements.length) * 100) / 100,
      weight_kg: Math.round((prevMeasurements.reduce((s, m) => s + m.weight_kg, 0) / prevMeasurements.length) * 100) / 100,
    };
    if (measurementAvg) {
      deltas = {
        waist_cm: Math.round((measurementAvg.waist_cm - previousWeekAvg.waist_cm) * 100) / 100,
        arm_right_cm: Math.round((measurementAvg.arm_right_cm - previousWeekAvg.arm_right_cm) * 100) / 100,
        arm_left_cm: Math.round((measurementAvg.arm_left_cm - previousWeekAvg.arm_left_cm) * 100) / 100,
        weight_kg: Math.round((measurementAvg.weight_kg - previousWeekAvg.weight_kg) * 100) / 100,
      };
    }
  }

  const progress = await getGoalProgress();

  return {
    week_start: weekStart,
    week_end: weekEnd,
    measurement_avg: measurementAvg,
    nutrition_avg: nutritionAvg,
    previous_week_avg: previousWeekAvg,
    deltas,
    rate_cm_per_week: progress.rate_cm_per_week,
    needed_rate_cm_per_week: progress.needed_rate_cm_per_week,
    projected_goal_date: progress.projected_goal_date,
    status: progress.status,
  };
}

export async function getHistory(metric: string, from: string, to: string): Promise<HistoryPoint[]> {
  const measurementColumns: Record<string, string> = {
    waist: 'waist_cm',
    arm_right: 'arm_right_cm',
    arm_left: 'arm_left_cm',
    weight: 'weight_kg',
  };

  const nutritionColumns: Record<string, string> = {
    calories: 'calories',
    protein: 'protein_g',
    carbs: 'carbs_g',
    fat: 'fat_g',
  };

  if (measurementColumns[metric]) {
    const column = measurementColumns[metric];
    const result = await db.execute({
      sql: `SELECT date, ${column} as value FROM measurements WHERE date >= ? AND date <= ? ORDER BY date`,
      args: [from, to],
    });
    return result.rows as unknown as HistoryPoint[];
  }

  if (nutritionColumns[metric]) {
    const column = nutritionColumns[metric];
    const result = await db.execute({
      sql: `SELECT date, SUM(${column}) as value FROM meals WHERE date >= ? AND date <= ? GROUP BY date ORDER BY date`,
      args: [from, to],
    });
    return result.rows as unknown as HistoryPoint[];
  }

  return [];
}

export async function getGoalProgress(): Promise<GoalProgress> {
  const settings = await SettingsService.get();
  const latest = await MeasurementService.getLatest();

  const currentWaist = latest?.waist_cm || settings.baseline_waist_cm;
  const remainingCm = Math.round((currentWaist - settings.waist_goal_cm) * 100) / 100;

  const baselineDate = new Date(settings.baseline_date + 'T12:00:00');
  const goalDate = new Date(settings.goal_date + 'T12:00:00');
  const today = new Date();

  const weeksElapsed = Math.max(0, (today.getTime() - baselineDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const weeksToGoal = Math.max(0, (goalDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));

  const totalLost = settings.baseline_waist_cm - currentWaist;
  const rateCmPerWeek = weeksElapsed > 0.5 ? Math.round((totalLost / weeksElapsed) * 100) / 100 : null;
  const neededRate = weeksToGoal > 0 ? Math.round((remainingCm / weeksToGoal) * 100) / 100 : remainingCm;

  let projectedGoalDate: string | null = null;
  if (rateCmPerWeek && rateCmPerWeek > 0) {
    const weeksNeeded = remainingCm / rateCmPerWeek;
    const projected = new Date(today);
    projected.setDate(projected.getDate() + Math.round(weeksNeeded * 7));
    projectedGoalDate = projected.toISOString().split('T')[0];
  }

  let status: 'on_track' | 'needs_adjustment' | 'behind' = 'on_track';
  if (projectedGoalDate) {
    const projDate = new Date(projectedGoalDate + 'T12:00:00');
    const diffWeeks = (projDate.getTime() - goalDate.getTime()) / (7 * 24 * 60 * 60 * 1000);
    if (diffWeeks > 1) status = 'behind';
    else if (diffWeeks > 0) status = 'needs_adjustment';
  } else if (weeksElapsed > 1) {
    status = 'behind';
  }

  return {
    current_waist_cm: currentWaist,
    goal_waist_cm: settings.waist_goal_cm,
    remaining_cm: remainingCm,
    weeks_elapsed: Math.round(weeksElapsed * 10) / 10,
    weeks_remaining: Math.round(weeksToGoal * 10) / 10,
    rate_cm_per_week: rateCmPerWeek,
    needed_rate_cm_per_week: neededRate,
    projected_goal_date: projectedGoalDate,
    achievable: projectedGoalDate ? new Date(projectedGoalDate + 'T12:00:00') <= goalDate : false,
    status,
  };
}
