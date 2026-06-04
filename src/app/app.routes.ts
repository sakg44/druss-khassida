import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/catalog/catalog.component').then(m => m.CatalogComponent),
  },
  {
    path: 'druss/:id',
    loadComponent: () => import('./features/druss-room/druss-room.component').then(m => m.DrussRoomComponent),
  },
  { path: '**', redirectTo: '' },
];
