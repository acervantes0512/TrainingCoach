import db from '../db/database.js';
import { Measurement, MeasurementInput } from '../types.js';

export async function getByDate(date: string): Promise<Measurement | undefined> {
  const result = await db.execute({ sql: 'SELECT * FROM measurements WHERE date = ?', args: [date] });
  if (result.rows.length === 0) return undefined;
  return result.rows[0] as unknown as Measurement;
}

export async function upsert(input: MeasurementInput): Promise<Measurement> {
  await db.execute({
    sql: `INSERT INTO measurements (date, waist_cm, arm_right_cm, arm_left_cm, weight_kg)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(date) DO UPDATE SET
            waist_cm = excluded.waist_cm,
            arm_right_cm = excluded.arm_right_cm,
            arm_left_cm = excluded.arm_left_cm,
            weight_kg = excluded.weight_kg`,
    args: [input.date, input.waist_cm, input.arm_right_cm, input.arm_left_cm, input.weight_kg],
  });
  return (await getByDate(input.date))!;
}

export async function getRange(from: string, to: string): Promise<Measurement[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM measurements WHERE date >= ? AND date <= ? ORDER BY date',
    args: [from, to],
  });
  return result.rows as unknown as Measurement[];
}

export async function getLatest(): Promise<Measurement | undefined> {
  const result = await db.execute('SELECT * FROM measurements ORDER BY date DESC LIMIT 1');
  if (result.rows.length === 0) return undefined;
  return result.rows[0] as unknown as Measurement;
}

export interface WeeklyAverage {
  week_start: string;
  waist_cm: number;
  arm_right_cm: number;
  arm_left_cm: number;
  weight_kg: number;
  days_count: number;
}

export async function getWeeklyAverages(from: string, to: string): Promise<WeeklyAverage[]> {
  const measurements = await getRange(from, to);
  if (measurements.length === 0) return [];

  const weeks = new Map<string, Measurement[]>();
  for (const m of measurements) {
    const d = new Date(m.date + 'T12:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const weekKey = monday.toISOString().split('T')[0];
    if (!weeks.has(weekKey)) weeks.set(weekKey, []);
    weeks.get(weekKey)!.push(m);
  }

  const result: WeeklyAverage[] = [];
  for (const [weekStart, ms] of [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const count = ms.length;
    result.push({
      week_start: weekStart,
      waist_cm: Math.round(ms.reduce((s, m) => s + m.waist_cm, 0) / count * 100) / 100,
      arm_right_cm: Math.round(ms.reduce((s, m) => s + m.arm_right_cm, 0) / count * 100) / 100,
      arm_left_cm: Math.round(ms.reduce((s, m) => s + m.arm_left_cm, 0) / count * 100) / 100,
      weight_kg: Math.round(ms.reduce((s, m) => s + m.weight_kg, 0) / count * 100) / 100,
      days_count: count,
    });
  }
  return result;
}
