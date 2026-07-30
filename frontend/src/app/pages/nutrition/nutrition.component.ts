import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DailySummary, Meal, MealInput, MealType, ProteinStreak, ProteinDistribution, SupplementStatus, AdherenceDay } from '../../models';

@Component({
  selector: 'app-nutrition',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nutrition.component.html',
  styleUrl: './nutrition.component.scss',
})
export class NutritionComponent implements OnInit {
  private api = inject(ApiService);

  currentDate = signal(new Date().toISOString().split('T')[0]);
  summary = signal<DailySummary | null>(null);
  proteinStreak = signal<ProteinStreak | null>(null);
  proteinDist = signal<ProteinDistribution[]>([]);
  supplements = signal<SupplementStatus | null>(null);
  adherence = signal<AdherenceDay[]>([]);
  showForm = signal(false);
  editingMeal = signal<Meal | null>(null);

  mealForm: MealInput = { date: '', meal_type: 'lunch', description: '', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  displayDate(): string {
    const d = new Date(this.currentDate() + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  ngOnInit(): void {
    this.loadDay();
    this.loadInsights();
  }

  loadDay(): void {
    const date = this.currentDate();
    this.api.getDailySummary(date).subscribe((s) => this.summary.set(s));
    this.api.getProteinDistribution(date).subscribe((d) => this.proteinDist.set(d));
    this.api.getSupplements(date).subscribe((s) => this.supplements.set(s));
  }

  loadInsights(): void {
    this.api.getProteinStreak().subscribe((s) => this.proteinStreak.set(s));
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    this.api.getAdherence(fourWeeksAgo.toISOString().split('T')[0], this.currentDate()).subscribe((a) => this.adherence.set(a));
  }

  prevDay(): void {
    const d = new Date(this.currentDate() + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    this.currentDate.set(d.toISOString().split('T')[0]);
    this.loadDay();
  }

  nextDay(): void {
    const d = new Date(this.currentDate() + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    this.currentDate.set(d.toISOString().split('T')[0]);
    this.loadDay();
  }

  openAddForm(): void {
    this.editingMeal.set(null);
    this.mealForm = { date: this.currentDate(), meal_type: 'lunch', description: '', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    this.showForm.set(true);
  }

  editMeal(meal: Meal): void {
    this.editingMeal.set(meal);
    this.mealForm = { date: meal.date, meal_type: meal.meal_type, description: meal.description, calories: meal.calories, protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g };
    this.showForm.set(true);
  }

  saveMeal(): void {
    const editing = this.editingMeal();
    if (editing) {
      this.api.updateMeal(editing.id, this.mealForm).subscribe(() => { this.showForm.set(false); this.loadDay(); });
    } else {
      this.mealForm.date = this.currentDate();
      this.api.createMeal(this.mealForm).subscribe(() => { this.showForm.set(false); this.loadDay(); });
    }
  }

  deleteMeal(id: number): void {
    this.api.deleteMeal(id).subscribe(() => this.loadDay());
  }

  toggleSupplement(type: 'creatine' | 'protein_powder'): void {
    const current = this.supplements();
    if (!current) return;
    const taken = type === 'creatine' ? !current.creatine : !current.protein_powder;
    this.api.toggleSupplement(this.currentDate(), type, taken).subscribe((s) => this.supplements.set(s));
  }

  getMealIcon(type: MealType): string {
    const icons: Record<MealType, string> = { breakfast: '🥣', lunch: '🥗', dinner: '🍽️', snack: '🍎', shake: '🥤' };
    return icons[type];
  }

  getMealLabel(type: MealType): string {
    const labels: Record<MealType, string> = { breakfast: 'Desayuno', lunch: 'Almuerzo', dinner: 'Cena', snack: 'Snack', shake: 'Batido' };
    return labels[type];
  }

  getMacroPercent(current: number, max: number): number {
    return Math.min(Math.round((current / max) * 100), 100);
  }
}
