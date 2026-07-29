import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as MeasurementService from '../services/measurement.service.js';
import * as MealService from '../services/meal.service.js';
import * as SettingsService from '../services/settings.service.js';
import * as SummaryService from '../services/summary.service.js';
import * as InsightsService from '../services/insights.service.js';
import * as SupplementService from '../services/supplement.service.js';
import * as GoalService from '../services/goal.service.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'training-coach',
    version: '1.0.0',
  });

  server.tool(
    'log_measurement',
    'Log or update body measurements for a specific date. Measurements are taken Mon-Fri only, fasted, in the morning after training. Weight is secondary — waist circumference is the priority metric.',
    {
      date: z.string().describe('Date in YYYY-MM-DD format'),
      waist_cm: z.number().describe('Waist circumference in cm'),
      arm_right_cm: z.number().describe('Right arm circumference in cm'),
      arm_left_cm: z.number().describe('Left arm circumference in cm'),
      weight_kg: z.number().describe('Body weight in kg'),
    },
    async ({ date, waist_cm, arm_right_cm, arm_left_cm, weight_kg }) => {
      const measurement = MeasurementService.upsert({ date, waist_cm, arm_right_cm, arm_left_cm, weight_kg });
      return { content: [{ type: 'text' as const, text: JSON.stringify(measurement) }] };
    }
  );

  server.tool(
    'log_meal',
    'Log a meal with macronutrients. Daily targets: protein 150-170g (HARD FLOOR 140g — non-negotiable, cannot be compensated across days), calories 2100-2300 kcal, carbs 180-220g, fat 60-70g. Calories/carbs/fat can be averaged weekly, but protein must meet the daily floor every single day.',
    {
      date: z.string().describe('Date in YYYY-MM-DD format'),
      meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'shake']).describe('Type of meal'),
      description: z.string().describe('Meal description'),
      calories: z.number().describe('Calories (kcal)'),
      protein_g: z.number().describe('Protein in grams'),
      carbs_g: z.number().describe('Carbohydrates in grams'),
      fat_g: z.number().describe('Fat in grams'),
      photo_url: z.string().optional().describe('Optional photo URL'),
    },
    async (params) => {
      const meal = MealService.create(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(meal) }] };
    }
  );

  server.tool(
    'update_meal',
    'Update an existing meal entry by ID.',
    {
      meal_id: z.number().describe('ID of the meal to update'),
      meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'shake']).optional(),
      description: z.string().optional(),
      calories: z.number().optional(),
      protein_g: z.number().optional(),
      carbs_g: z.number().optional(),
      fat_g: z.number().optional(),
      photo_url: z.string().optional(),
    },
    async ({ meal_id, ...updates }) => {
      const meal = MealService.update(meal_id, updates);
      if (!meal) return { content: [{ type: 'text' as const, text: 'Meal not found' }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(meal) }] };
    }
  );

  server.tool(
    'delete_meal',
    'Delete a meal entry by ID.',
    {
      meal_id: z.number().describe('ID of the meal to delete'),
    },
    async ({ meal_id }) => {
      const deleted = await MealService.remove(meal_id);
      return { content: [{ type: 'text' as const, text: deleted ? 'Deleted successfully' : 'Meal not found' }] };
    }
  );

  server.tool(
    'get_day_summary',
    'Get complete daily summary: measurements, all meals, macro totals vs targets with status indicators (green/amber/red). Protein has a HARD daily floor of 140g that cannot be compensated across days.',
    {
      date: z.string().describe('Date in YYYY-MM-DD format'),
    },
    async ({ date }) => {
      const summary = SummaryService.getDailySummary(date);
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary) }] };
    }
  );

  server.tool(
    'get_week_summary',
    'Get weekly summary: Mon-Fri measurement averages, daily macro averages, deltas vs previous week, waist loss rate (cm/week), needed rate, and projected goal date. Measurements are ONLY taken Mon-Fri; weekends do not count. Waist is priority — weight is secondary.',
    {
      week_start_date: z.string().describe('Monday date of the week in YYYY-MM-DD format'),
    },
    async ({ week_start_date }) => {
      const summary = SummaryService.getWeeklySummary(week_start_date);
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary) }] };
    }
  );

  server.tool(
    'get_history',
    'Get time series data for a metric. Available: waist, arm_right, arm_left, weight, calories, protein, carbs, fat.',
    {
      metric: z.string().describe('Metric: waist, arm_right, arm_left, weight, calories, protein, carbs, fat'),
      from_date: z.string().describe('Start date YYYY-MM-DD'),
      to_date: z.string().describe('End date YYYY-MM-DD'),
    },
    async ({ metric, from_date, to_date }) => {
      const history = SummaryService.getHistory(metric, from_date, to_date);
      return { content: [{ type: 'text' as const, text: JSON.stringify(history) }] };
    }
  );

  server.tool(
    'get_goal_progress',
    'Get current goal progress: waist cm remaining, loss rate, weeks remaining, projected completion date, achievability. Goal: waist <= 94cm by Sep 27 2026, from 100.5cm on Jul 27 2026. Target rate ~0.73 cm/week.',
    {},
    async () => {
      const progress = SummaryService.getGoalProgress();
      return { content: [{ type: 'text' as const, text: JSON.stringify(progress) }] };
    }
  );

  server.tool(
    'update_settings',
    'Update goal settings (targets, dates, macro ranges).',
    {
      waist_goal_cm: z.number().optional(),
      goal_date: z.string().optional(),
      protein_min_g: z.number().optional(),
      protein_max_g: z.number().optional(),
      protein_floor_g: z.number().optional(),
      calories_min: z.number().optional(),
      calories_max: z.number().optional(),
      carbs_min_g: z.number().optional(),
      carbs_max_g: z.number().optional(),
      fat_min_g: z.number().optional(),
      fat_max_g: z.number().optional(),
    },
    async (params) => {
      const settings = SettingsService.update(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(settings) }] };
    }
  );

  server.tool(
    'get_protein_streak',
    'Get the current consecutive-day streak of hitting the protein floor (≥140g/day). Also returns the all-time longest streak. Use this to motivate consistency.',
    {},
    async () => {
      const streak = await InsightsService.getProteinStreak();
      return { content: [{ type: 'text' as const, text: JSON.stringify(streak) }] };
    }
  );

  server.tool(
    'get_adherence_calendar',
    'Get a day-by-day adherence heatmap for a date range. Each day is green (protein + calories on target), yellow (one of two), red (neither), or none (no data/weekend). Perfect for reviewing weekly/monthly consistency.',
    {
      from_date: z.string().describe('Start date YYYY-MM-DD'),
      to_date: z.string().describe('End date YYYY-MM-DD'),
    },
    async ({ from_date, to_date }) => {
      const calendar = await InsightsService.getAdherenceCalendar(from_date, to_date);
      return { content: [{ type: 'text' as const, text: JSON.stringify(calendar) }] };
    }
  );

  server.tool(
    'get_milestones',
    'Get waist circumference milestones (100, 99, 98, 97, 96, 95, 94 cm). Shows which have been reached and on what date. Use to celebrate progress.',
    {},
    async () => {
      const milestones = await InsightsService.getMilestones();
      return { content: [{ type: 'text' as const, text: JSON.stringify(milestones) }] };
    }
  );

  server.tool(
    'get_deficit_efficiency',
    'Get the deficit efficiency ratio: cm of waist lost per kg of weight lost. Ratio > 0.8 = excellent (losing visceral fat preferentially). Ratio < 0.4 = warning (may be losing muscle).',
    {},
    async () => {
      const efficiency = await InsightsService.getDeficitEfficiency();
      return { content: [{ type: 'text' as const, text: JSON.stringify(efficiency) }] };
    }
  );

  server.tool(
    'get_protein_distribution',
    'Get protein distribution across meals for a specific day. Each meal should ideally have 25-55g protein for optimal muscle protein synthesis. Flags each meal as optimal or not.',
    {
      date: z.string().describe('Date in YYYY-MM-DD format'),
    },
    async ({ date }) => {
      const distribution = await InsightsService.getProteinDistribution(date);
      return { content: [{ type: 'text' as const, text: JSON.stringify(distribution) }] };
    }
  );

  server.tool(
    'get_waist_to_height_ratio',
    'Get the Waist-to-Height Ratio (WHtR) — a key cardiometabolic health marker. Categories: ≤0.46 excellent, ≤0.53 healthy, ≤0.60 increased risk, >0.60 high risk. Target: < 0.50.',
    {},
    async () => {
      const whtr = await InsightsService.getWaistToHeightRatio();
      return { content: [{ type: 'text' as const, text: JSON.stringify(whtr) }] };
    }
  );

  server.tool(
    'get_training_today',
    'Get today\'s training split. Schedule: Mon/Thu = Pull (back, biceps), Tue/Fri = Push (chest, triceps, shoulders), Wed = Legs. Weekends = rest. Returns null on rest days.',
    {},
    async () => {
      const training = InsightsService.getTodayTraining();
      return { content: [{ type: 'text' as const, text: JSON.stringify(training) }] };
    }
  );

  server.tool(
    'get_weekly_report',
    'Get a comprehensive weekly report card with letter grades (A+/A/B/C/D) for: protein compliance, calorie compliance, measurement consistency, waist loss rate, and arm preservation. Includes an overall grade and motivational message.',
    {
      week_start_date: z.string().describe('Monday date of the week in YYYY-MM-DD format'),
    },
    async ({ week_start_date }) => {
      const report = await InsightsService.getWeeklyReport(week_start_date);
      return { content: [{ type: 'text' as const, text: JSON.stringify(report) }] };
    }
  );

  server.tool(
    'get_supplements',
    'Get supplement checklist status for a specific date: creatine (5g daily) and protein powder.',
    {
      date: z.string().describe('Date in YYYY-MM-DD format'),
    },
    async ({ date }) => {
      const status = await SupplementService.getByDate(date);
      return { content: [{ type: 'text' as const, text: JSON.stringify(status) }] };
    }
  );

  server.tool(
    'toggle_supplement',
    'Mark a supplement as taken or not taken for a specific date. Supplements: creatine (5g daily, non-negotiable) and protein_powder.',
    {
      date: z.string().describe('Date in YYYY-MM-DD format'),
      supplement_type: z.enum(['creatine', 'protein_powder']).describe('Type of supplement'),
      taken: z.boolean().describe('Whether the supplement was taken'),
    },
    async ({ date, supplement_type, taken }) => {
      const status = await SupplementService.toggle(date, supplement_type, taken);
      return { content: [{ type: 'text' as const, text: JSON.stringify(status) }] };
    }
  );

  server.tool(
    'get_goals',
    'Get all active fitness goals. Goals can track any metric: waist_cm, weight_kg, arm_right_cm, arm_left_cm. Each has direction (decrease/increase/maintain), target value, baseline, and dates.',
    {},
    async () => {
      const goals = await GoalService.getActive();
      return { content: [{ type: 'text' as const, text: JSON.stringify(goals) }] };
    }
  );

  server.tool(
    'get_goals_progress',
    'Get progress for all active goals. Returns current value, % complete, ideal value for today, difference from ideal line, and whether on track. Includes history with actual vs ideal for charting.',
    {},
    async () => {
      const progress = await GoalService.getAllProgress();
      return { content: [{ type: 'text' as const, text: JSON.stringify(progress) }] };
    }
  );

  server.tool(
    'create_goal',
    'Create a new fitness goal. Metrics: waist_cm, weight_kg, arm_right_cm, arm_left_cm. Direction: decrease (lose), increase (gain), maintain. Provide baseline, target, start and end dates.',
    {
      metric: z.string().describe('Metric to track: waist_cm, weight_kg, arm_right_cm, arm_left_cm'),
      label: z.string().describe('Human-readable goal name, e.g. "Reducir cintura a 94cm"'),
      direction: z.enum(['decrease', 'increase', 'maintain']).describe('Goal direction'),
      target_value: z.number().describe('Target value to reach'),
      baseline_value: z.number().describe('Starting value'),
      start_date: z.string().describe('Goal start date YYYY-MM-DD'),
      target_date: z.string().describe('Target completion date YYYY-MM-DD'),
    },
    async (params) => {
      const goal = await GoalService.create(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(goal) }] };
    }
  );

  server.tool(
    'update_goal',
    'Update an existing goal by ID. Can change target, dates, label, or deactivate it.',
    {
      goal_id: z.number().describe('ID of the goal to update'),
      label: z.string().optional(),
      target_value: z.number().optional(),
      target_date: z.string().optional(),
      active: z.number().optional().describe('1 = active, 0 = inactive'),
    },
    async ({ goal_id, ...updates }) => {
      const goal = await GoalService.update(goal_id, updates);
      if (!goal) return { content: [{ type: 'text' as const, text: 'Goal not found' }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(goal) }] };
    }
  );

  return server;
}
