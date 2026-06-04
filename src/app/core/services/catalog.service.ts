import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { KhassidaCatalog, KhassidaInfo } from '../models/khassida.model';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);

  private catalog$ = this.http.get<KhassidaCatalog>('assets/data/khassidas.json').pipe(
    shareReplay(1)
  );

  getKhassidas(): Observable<KhassidaInfo[]> {
    return this.catalog$.pipe(map(c => c.khassidas));
  }

  getR2BaseUrl(): Observable<string> {
    return this.catalog$.pipe(map(c => c.r2BaseUrl));
  }

  getById(id: string): Observable<KhassidaInfo | undefined> {
    return this.getKhassidas().pipe(map(list => list.find(k => k.id === id)));
  }
}
