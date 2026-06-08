import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { KhassidaDetail, Segment, HighlightZone } from '../models/khassida.model';
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
      map(d => (d.segments ?? []).filter(s => s.vers === vers).sort((a, b) => a.xaab - b.xaab))
    );
  }

  getPdfPage(detail: KhassidaDetail, vers: number): number {
    const effectiveVers = this.getOriginalVers(detail, vers);

    // Si des annotations existent, elles font autorité sur la page
    const ann = detail.annotations?.find(a => a.vers === effectiveVers);
    if (ann) return ann.page;

    const { startPage, versPerPage } = detail.pdfMapping;
    return startPage + Math.floor((effectiveVers - 1) / versPerPage);
  }

  /**
   * Renvoie la zone de surbrillance (page + bornes y normalisées) du vers,
   * ou null si non annoté.
   *
   * En mode 'xaab', la zone du bayt est découpée en `xaab_per_vers` tranches
   * et seule la tranche du xaab en cours est renvoyée (ligne par ligne).
   * En mode 'vers'/'boucle', le bayt entier est renvoyé.
   */
  getHighlightZone(
    detail: KhassidaDetail,
    vers: number,
    opts?: { mode?: string; xaab?: number },
  ): HighlightZone | null {
    const effectiveVers = this.getOriginalVers(detail, vers);
    const ann = detail.annotations?.find(a => a.vers === effectiveVers);
    if (!ann) return null;

    // Mode xaab : découper la zone en tranches égales (1 par ligne)
    if (opts?.mode === 'xaab' && opts.xaab && detail.xaab_per_vers > 1) {
      const slices = detail.xaab_per_vers;
      const sliceH = (ann.yEnd - ann.yStart) / slices;
      const i = Math.min(Math.max(opts.xaab, 1), slices) - 1;
      const yStart = ann.yStart + i * sliceH;
      return { page: ann.page, yStart, yEnd: yStart + sliceH };
    }

    return { page: ann.page, yStart: ann.yStart, yEnd: ann.yEnd };
  }

  hasAnnotations(detail: KhassidaDetail): boolean {
    return (detail.annotations?.length ?? 0) > 0;
  }

  /**
   * Convertit un numéro de segment audio (1..audio_vers) vers le numéro
   * de bayt physique sur le PDF (1..nb_vers).
   *
   * Un `repeat` à audioVers=k signifie que ce segment rejoue le MÊME bayt
   * que le segment précédent. Chaque répétition décale donc tous les
   * segments suivants : bayt = audioVers − (nb de répétitions ≤ audioVers).
   */
  getOriginalVers(detail: KhassidaDetail, audioVers: number): number {
    const repeatsBefore = (detail.repeats ?? []).filter(r => r.audioVers <= audioVers).length;
    return audioVers - repeatsBefore;
  }

  isRepeat(detail: KhassidaDetail, audioVers: number): boolean {
    return detail.repeats?.some(r => r.audioVers === audioVers) ?? false;
  }

  getMaxAudioVers(detail: KhassidaDetail): number {
    return detail.audio_vers ?? detail.nb_vers;
  }
}
