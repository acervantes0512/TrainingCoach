import db from '../db/database.js';
import { Settings } from '../types.js';

export async function get(): Promise<Settings> {
  const result = await db.execute('SELECT * FROM settings WHERE id = 1');
  const row = result.rows[0] as unknown as Settings & { id: number };
  const { ...settings } = row;
  return settings;
}

export async function update(input: Partial<Settings>): Promise<Settings> {
  const current = await get();
  const updated = { ...current, ...input };

  await db.execute({
    sql: `UPDATE settings SET
            waist_goal_cm = ?, goal_date = ?, baseline_waist_cm = ?, baseline_date = ?,
            protein_min_g = ?, protein_max_g = ?, protein_floor_g = ?,
            calories_min = ?, calories_max = ?,
            carbs_min_g = ?, carbs_max_g = ?,
            fat_min_g = ?, fat_max_g = ?,
            height_cm = ?, initial_weight_kg = ?
          WHERE id = 1`,
    args: [
      updated.waist_goal_cm, updated.goal_date, updated.baseline_waist_cm, updated.baseline_date,
      updated.protein_min_g, updated.protein_max_g, updated.protein_floor_g,
      updated.calories_min, updated.calories_max,
      updated.carbs_min_g, updated.carbs_max_g,
      updated.fat_min_g, updated.fat_max_g,
      updated.height_cm, updated.initial_weight_kg,
    ],
  });

  return get();
}
