import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { KhassidaDetail, Segment } from '../models/khassida.model';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class KhassidaService {
  private http = inject(HttpClient);
  private cache = new Map<string, Observable<KhassidaDetail>>();

  getDetail(id: string): Observable<KhassidaDetail> {
    if (!this.cache.has(id)) {
      const req = this.http.get<KhassidaDetail>(`assets/data/${id}.json`).pipe(shareReplay(1));
      this.cache.set(id, req);
    }
    return this.cache.get(id)!;
  }

  getSegmentsForVers(id: string, vers: number): Observable<Segment[]> {
    return this.getDetail(id).pipe(
      map(d => d.segments.filter(s => s.vers === vers).sort((a, b) => a.xaab - b.xaab))
    );
  }

  getPdfPage(detail: KhassidaDetail, vers: number): number {
    const { startPage, versPerPage } = detail.pdfMapping;
    const effectiveVers = this.getOriginalVers(detail, vers);
    return startPage + Math.floor((effectiveVers - 1) / versPerPage);
  }

  getOriginalVers(detail: KhassidaDetail, audioVers: number): number {
    const repeat = detail.repeats?.find(r => r.audioVers === audioVers);
    return repeat ? repeat.originalVers : audioVers;
  }

  isRepeat(detail: KhassidaDetail, audioVers: number): boolean {
    return detail.repeats?.some(r => r.audioVers === audioVers) ?? false;
  }

  getMaxAudioVers(detail: KhassidaDetail): number {
    return detail.audio_vers ?? detail.nb_vers;
  }
}
