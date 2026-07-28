import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { MacroBarComponent } from '../../components/macro-bar/macro-bar.component';
import { DailySummary, MealInput, MealType, ProteinStreak, ProteinDistribution, TrainingDay, SupplementStatus } from '../../models';

@Component({
  selector: 'app-daily',
  standalone: true,
  imports: [CommonModule, FormsModule, MacroBarComponent],
  templateUrl: './daily.component.html',
  styleUrl: './daily.component.scss',
})
export class DailyComponent implements OnInit {
  private api = inject(ApiService);

  currentDate = signal(this.todayString());
  summary = signal<DailySummary | null>(null);
  showMealForm = signal(false);
  loading = signal(false);
  proteinStreak = signal<ProteinStreak | null>(null);
  proteinDistribution = signal<ProteinDistribution[]>([]);
  trainingDay = signal<TrainingDay | null>(null);
  supplements = signal<SupplementStatus | null>(null);

  measurementForm = {
    waist_cm: null as number | null,
    arm_right_cm: null as number | null,
    arm_left_cm: null as number | null,
    weight_kg: null as number | null,
  };

  mealForm: { meal_type: MealType; description: string; calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null } = {
    meal_type: 'lunch',
    description: '',
    calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
  };

  displayDate = computed(() => {
    const d = new Date(this.currentDate() + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' });
  });

  ngOnInit(): void {
    this.loadSummary();
    this.loadInsights();
  }

  loadInsights(): void {
    this.api.getProteinStreak().subscribe((s) => this.proteinStreak.set(s));
    this.api.getTrainingToday().subscribe((t) => this.trainingDay.set(t));
    this.loadDateInsights();
  }

  loadDateInsights(): void {
    this.api.getProteinDistribution(this.currentDate()).subscribe((d) => this.proteinDistribution.set(d));
    this.api.getSupplements(this.currentDate()).subscribe((s) => this.supplements.set(s));
  }

  toggleSupplement(type: 'creatine' | 'protein_powder'): void {
    const current = this.supplements();
    if (!current) return;
    const taken = type === 'creatine' ? !current.creatine : !current.protein_powder;
    this.api.toggleSupplement(this.currentDate(), type, taken).subscribe((s) => this.supplements.set(s));
  }

  loadSummary(): void {
    this.loading.set(true);
    this.api.getDailySummary(this.currentDate()).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  prevDay(): void {
    const d = new Date(this.currentDate() + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    this.currentDate.set(d.toISOString().split('T')[0]);
    this.loadSummary();
    this.loadDateInsights();
  }

  nextDay(): void {
    const d = new Date(this.currentDate() + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    this.currentDate.set(d.toISOString().split('T')[0]);
    this.loadSummary();
    this.loadDateInsights();
  }

  saveMeasurement(): void {
    const { waist_cm, arm_right_cm, arm_left_cm, weight_kg } = this.measurementForm;
    if (waist_cm == null || arm_right_cm == null || arm_left_cm == null || weight_kg == null) return;

    this.api.saveMeasurement({
      date: this.currentDate(),
      waist_cm,
      arm_right_cm,
      arm_left_cm,
      weight_kg,
    }).subscribe(() => this.loadSummary());
  }

  saveMeal(): void {
    const { meal_type, description, calories, protein_g, carbs_g, fat_g } = this.mealForm;
    if (!description || calories == null || protein_g == null || carbs_g == null || fat_g == null) return;

    const input: MealInput = {
      date: this.currentDate(),
      meal_type,
      description,
      calories,
      protein_g,
      carbs_g,
      fat_g,
    };

    this.api.createMeal(input).subscribe(() => {
      this.showMealForm.set(false);
      this.resetMealForm();
      this.loadSummary();
    });
  }

  deleteMeal(id: number): void {
    this.api.deleteMeal(id).subscribe(() => this.loadSummary());
  }

  getMealIcon(type: MealType): string {
    const icons: Record<MealType, string> = {
      breakfast: '🥣',
      lunch: '🥗',
      dinner: '🍽️',
      snack: '🍎',
      shake: '🥤',
    };
    return icons[type];
  }

  getMealLabel(type: MealType): string {
    const labels: Record<MealType, string> = {
      breakfast: 'Desayuno',
      lunch: 'Almuerzo',
      dinner: 'Cena',
      snack: 'Snack',
      shake: 'Batido',
    };
    return labels[type];
  }

  private resetMealForm(): void {
    this.mealForm = { meal_type: 'lunch', description: '', calories: null, protein_g: null, carbs_g: null, fat_g: null };
  }

  private todayString(): string {
    return new Date().toISOString().split('T')[0];
  }
}
