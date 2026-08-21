import { Routes } from '@angular/router';
import { PurchasesService } from './purchases.service';

export const PURCHASES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./purchases.page').then((module) => module.PurchasesPage),
    providers: [PurchasesService],
  },
];
