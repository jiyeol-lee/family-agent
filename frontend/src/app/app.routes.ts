import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'purchases' },
  {
    path: 'purchases',
    loadChildren: () => import('@pages/purchases/purchases.routes').then((module) => module.PURCHASES_ROUTES),
  },
  { path: '**', redirectTo: 'purchases' },
];
