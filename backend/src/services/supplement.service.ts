import db from '../db/database.js';

export interface SupplementStatus {
  date: string;
  creatine: boolean;
  protein_powder: boolean;
}

export async function getByDate(date: string): Promise<SupplementStatus> {
  const result = await db.execute({
    sql: 'SELECT supplement_type, taken FROM supplements WHERE date = ?',
    args: [date],
  });

  const status: SupplementStatus = { date, creatine: false, protein_powder: false };
  for (const row of result.rows as unknown as { supplement_type: string; taken: number }[]) {
    if (row.supplement_type === 'creatine') status.creatine = row.taken === 1;
    if (row.supplement_type === 'protein_powder') status.protein_powder = row.taken === 1;
  }
  return status;
}

export async function toggle(date: string, supplementType: 'creatine' | 'protein_powder', taken: boolean): Promise<SupplementStatus> {
  await db.execute({
    sql: `INSERT INTO supplements (date, supplement_type, taken) VALUES (?, ?, ?)
          ON CONFLICT(date, supplement_type) DO UPDATE SET taken = ?`,
    args: [date, supplementType, taken ? 1 : 0, taken ? 1 : 0],
  });
  return getByDate(date);
}
