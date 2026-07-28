import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'daily', pathMatch: 'full' },
  { path: 'daily', loadComponent: () => import('./pages/daily/daily.component').then(m => m.DailyComponent) },
  { path: 'weekly', loadComponent: () => import('./pages/weekly/weekly.component').then(m => m.WeeklyComponent) },
  { path: 'trends', loadComponent: () => import('./pages/trends/trends.component').then(m => m.TrendsComponent) },
];
