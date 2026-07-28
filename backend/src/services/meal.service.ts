import db from '../db/database.js';
import { Meal, MealInput } from '../types.js';

export async function getByDate(date: string): Promise<Meal[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM meals WHERE date = ? ORDER BY created_at',
    args: [date],
  });
  return result.rows as unknown as Meal[];
}

export async function create(input: MealInput): Promise<Meal> {
  const result = await db.execute({
    sql: `INSERT INTO meals (date, meal_type, description, calories, protein_g, carbs_g, fat_g, photo_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [input.date, input.meal_type, input.description, input.calories, input.protein_g, input.carbs_g, input.fat_g, input.photo_url || null],
  });
  const row = await db.execute({ sql: 'SELECT * FROM meals WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return row.rows[0] as unknown as Meal;
}

export async function update(id: number, input: Partial<MealInput>): Promise<Meal | undefined> {
  const existing = await db.execute({ sql: 'SELECT * FROM meals WHERE id = ?', args: [id] });
  if (existing.rows.length === 0) return undefined;

  const current = existing.rows[0] as unknown as Meal;
  const updated = { ...current, ...input };
  await db.execute({
    sql: `UPDATE meals SET
            meal_type = ?, description = ?, calories = ?,
            protein_g = ?, carbs_g = ?, fat_g = ?, photo_url = ?
          WHERE id = ?`,
    args: [updated.meal_type, updated.description, updated.calories, updated.protein_g, updated.carbs_g, updated.fat_g, updated.photo_url, id],
  });
  const row = await db.execute({ sql: 'SELECT * FROM meals WHERE id = ?', args: [id] });
  return row.rows[0] as unknown as Meal;
}

export async function remove(id: number): Promise<boolean> {
  const result = await db.execute({ sql: 'DELETE FROM meals WHERE id = ?', args: [id] });
  return result.rowsAffected > 0;
}
