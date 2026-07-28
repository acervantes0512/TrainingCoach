export interface Measurement {
  id: number;
  date: string;
  waist_cm: number;
  arm_right_cm: number;
  arm_left_cm: number;
  weight_kg: number;
  created_at: string;
}

export interface MeasurementInput {
  date: string;
  waist_cm: number;
  arm_right_cm: number;
  arm_left_cm: number;
  weight_kg: number;
}

export interface Meal {
  id: number;
  date: string;
  meal_type: MealType;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  photo_url: string | null;
  created_at: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'shake';

export interface MealInput {
  date: string;
  meal_type: MealType;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  photo_url?: string;
}

export interface Settings {
  waist_goal_cm: number;
  goal_date: string;
  baseline_waist_cm: number;
  baseline_date: string;
  protein_min_g: number;
  protein_max_g: number;
  protein_floor_g: number;
  calories_min: number;
  calories_max: number;
  carbs_min_g: number;
  carbs_max_g: number;
  fat_min_g: number;
  fat_max_g: number;
  height_cm: number;
  initial_weight_kg: number;
}

export type MacroStatus = 'green' | 'amber' | 'red';

export interface MacroProgress {
  label: string;
  current: number;
  min: number;
  max: number;
  status: MacroStatus;
}

export interface DailySummary {
  date: string;
  measurement: Measurement | null;
  meals: Meal[];
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  macros: MacroProgress[];
}

export interface WeeklySummary {
  week_start: string;
  week_end: string;
  measurement_avg: {
    waist_cm: number;
    arm_right_cm: number;
    arm_left_cm: number;
    weight_kg: number;
    days_measured: number;
  } | null;
  nutrition_avg: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    days_logged: number;
  };
  previous_week_avg: {
    waist_cm: number;
    arm_right_cm: number;
    arm_left_cm: number;
    weight_kg: number;
  } | null;
  deltas: {
    waist_cm: number;
    arm_right_cm: number;
    arm_left_cm: number;
    weight_kg: number;
  } | null;
  rate_cm_per_week: number | null;
  needed_rate_cm_per_week: number | null;
  projected_goal_date: string | null;
  status: 'on_track' | 'needs_adjustment' | 'behind';
}

export interface HistoryPoint {
  date: string;
  value: number;
}

export interface GoalProgress {
  current_waist_cm: number;
  goal_waist_cm: number;
  remaining_cm: number;
  weeks_elapsed: number;
  weeks_remaining: number;
  rate_cm_per_week: number | null;
  needed_rate_cm_per_week: number;
  projected_goal_date: string | null;
  achievable: boolean;
  status: 'on_track' | 'needs_adjustment' | 'behind';
}
