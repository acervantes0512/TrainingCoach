import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'measurements', loadComponent: () => import('./pages/measurements/measurements.component').then(m => m.MeasurementsComponent) },
  { path: 'nutrition', loadComponent: () => import('./pages/nutrition/nutrition.component').then(m => m.NutritionComponent) },
  { path: 'goals', loadComponent: () => import('./pages/goals/goals.component').then(m => m.GoalsComponent) },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
  { path: '**', redirectTo: 'dashboard' },
];
