import db from '../db/database.js';
import * as MeasurementService from './measurement.service.js';

export interface Goal {
  id: number;
  metric: string;
  label: string;
  direction: 'decrease' | 'increase' | 'maintain';
  target_value: number;
  baseline_value: number;
  start_date: string;
  target_date: string;
  active: number;
  created_at: string;
}

export interface GoalProgress {
  goal: Goal;
  current_value: number | null;
  percent_complete: number;
  ideal_today: number;
  diff_from_ideal: number;
  on_track: boolean;
  history: { date: string; actual: number; ideal: number }[];
  ideal_line: { date: string; value: number }[];
}

export interface GoalInput {
  metric: string;
  label: string;
  direction: 'decrease' | 'increase' | 'maintain';
  target_value: number;
  baseline_value: number;
  start_date: string;
  target_date: string;
}

const METRIC_COLUMN_MAP: Record<string, string> = {
  waist_cm: 'waist_cm',
  arm_right_cm: 'arm_right_cm',
  arm_left_cm: 'arm_left_cm',
  weight_kg: 'weight_kg',
};

export async function getAll(): Promise<Goal[]> {
  const result = await db.execute('SELECT * FROM goals ORDER BY active DESC, created_at DESC');
  return result.rows as unknown as Goal[];
}

export async function getActive(): Promise<Goal[]> {
  const result = await db.execute('SELECT * FROM goals WHERE active = 1 ORDER BY created_at');
  return result.rows as unknown as Goal[];
}

export async function getById(id: number): Promise<Goal | null> {
  const result = await db.execute({ sql: 'SELECT * FROM goals WHERE id = ?', args: [id] });
  return (result.rows[0] as unknown as Goal) || null;
}

export async function create(input: GoalInput): Promise<Goal> {
  const result = await db.execute({
    sql: `INSERT INTO goals (metric, label, direction, target_value, baseline_value, start_date, target_date)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [input.metric, input.label, input.direction, input.target_value, input.baseline_value, input.start_date, input.target_date],
  });
  const id = Number(result.lastInsertRowid);
  return (await getById(id))!;
}

export async function update(id: number, input: Partial<GoalInput & { active: number }>): Promise<Goal | null> {
  const current = await getById(id);
  if (!current) return null;

  const updated = { ...current, ...input };
  await db.execute({
    sql: `UPDATE goals SET metric = ?, label = ?, direction = ?, target_value = ?, baseline_value = ?,
          start_date = ?, target_date = ?, active = ? WHERE id = ?`,
    args: [updated.metric, updated.label, updated.direction, updated.target_value, updated.baseline_value,
           updated.start_date, updated.target_date, updated.active, id],
  });
  return getById(id);
}

export async function remove(id: number): Promise<boolean> {
  const result = await db.execute({ sql: 'DELETE FROM goals WHERE id = ?', args: [id] });
  return result.rowsAffected > 0;
}

export async function getProgress(id: number): Promise<GoalProgress | null> {
  const goal = await getById(id);
  if (!goal) return null;

  const column = METRIC_COLUMN_MAP[goal.metric];
  if (!column) return null;

  const measurements = await MeasurementService.getRange(goal.start_date, goal.target_date);

  const startDate = new Date(goal.start_date + 'T12:00:00');
  const endDate = new Date(goal.target_date + 'T12:00:00');
  const totalDays = (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const daysElapsed = Math.min((today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000), totalDays);

  const idealToday = totalDays > 0
    ? goal.baseline_value + ((goal.target_value - goal.baseline_value) * daysElapsed / totalDays)
    : goal.target_value;

  const latest = await MeasurementService.getLatest();
  const currentValue = latest ? (latest as unknown as Record<string, number>)[column] : null;

  let percentComplete = 0;
  if (currentValue !== null) {
    const totalChange = Math.abs(goal.target_value - goal.baseline_value);
    if (totalChange > 0) {
      const actualChange = Math.abs(currentValue - goal.baseline_value);
      const inRightDirection = goal.direction === 'decrease'
        ? currentValue <= goal.baseline_value
        : goal.direction === 'increase'
          ? currentValue >= goal.baseline_value
          : true;
      percentComplete = inRightDirection ? Math.min(Math.round((actualChange / totalChange) * 100), 100) : 0;
    } else {
      percentComplete = 100;
    }
  }

  const diffFromIdeal = currentValue !== null ? Math.round((currentValue - idealToday) * 100) / 100 : 0;

  let onTrack = true;
  if (currentValue !== null) {
    if (goal.direction === 'decrease') onTrack = currentValue <= idealToday + 0.3;
    else if (goal.direction === 'increase') onTrack = currentValue >= idealToday - 0.3;
    else onTrack = Math.abs(currentValue - goal.baseline_value) <= 1;
  }

  const history = measurements.map((m) => {
    const mDate = new Date(m.date + 'T12:00:00');
    const mDays = (mDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
    const ideal = goal.baseline_value + ((goal.target_value - goal.baseline_value) * mDays / totalDays);
    return {
      date: m.date,
      actual: (m as unknown as Record<string, number>)[column],
      ideal: Math.round(ideal * 100) / 100,
    };
  });

  const idealLine: { date: string; value: number }[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 7)) {
    const dDays = (d.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
    const val = goal.baseline_value + ((goal.target_value - goal.baseline_value) * dDays / totalDays);
    idealLine.push({ date: d.toISOString().split('T')[0], value: Math.round(val * 100) / 100 });
  }
  if (idealLine[idealLine.length - 1]?.date !== goal.target_date) {
    idealLine.push({ date: goal.target_date, value: goal.target_value });
  }

  return {
    goal,
    current_value: currentValue,
    percent_complete: percentComplete,
    ideal_today: Math.round(idealToday * 100) / 100,
    diff_from_ideal: diffFromIdeal,
    on_track: onTrack,
    history,
    ideal_line: idealLine,
  };
}

export async function getAllProgress(): Promise<GoalProgress[]> {
  const activeGoals = await getActive();
  const results: GoalProgress[] = [];
  for (const goal of activeGoals) {
    const progress = await getProgress(goal.id);
    if (progress) results.push(progress);
  }
  return results;
}
