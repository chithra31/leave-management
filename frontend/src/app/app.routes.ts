import { Routes } from '@angular/router';
import { roleGuard } from './core/auth';

// The server enforces roles; these guards only keep users off screens that would just show errors.
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  {
    path: 'my-leave',
    canActivate: [roleGuard],
    data: { roles: ['employee'] },
    loadComponent: () => import('./pages/my-leave').then((m) => m.MyLeave),
  },
  {
    path: 'approvals',
    canActivate: [roleGuard],
    data: { roles: ['manager'] },
    loadComponent: () => import('./pages/approvals').then((m) => m.Approvals),
  },
  {
    path: 'calendar',
    canActivate: [roleGuard],
    loadComponent: () => import('./pages/team-calendar').then((m) => m.TeamCalendar),
  },
  {
    path: 'admin',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () => import('./pages/admin').then((m) => m.Admin),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
