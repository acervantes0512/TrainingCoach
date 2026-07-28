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
