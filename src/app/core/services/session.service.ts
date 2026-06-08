import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, takeUntil, take } from 'rxjs';
import { DrussSession, SessionConfig } from '../models/druss-session.model';
import { AudioService } from './audio.service';
import { CatalogService } from './catalog.service';
import { KhassidaService } from './khassida.service';
import { KhassidaDetail } from '../models/khassida.model';

const DEFAULT_SESSION: DrussSession = {
  config: {
    khassidaId: '',
    daadjId: '',
    startVers: 1,
    endVers: 1,
    repetitions: 3,
    playbackMode: 'vers',
    playbackRate: 1,
  },
  currentVers: 1,
  currentXaab: 1,
  currentRepetition: 1,
  currentLoopPass: 1,
  isRepeat: false,
  repeatOf: null,
  isPlaying: false,
  isPaused: false,
  isComplete: false,
};

@Injectable({ providedIn: 'root' })
export class SessionService implements OnDestroy {
  private audio = inject(AudioService);
  private catalogService = inject(CatalogService);
  private khassidaService = inject(KhassidaService);

  private destroy$ = new Subject<void>();
  private detail: KhassidaDetail | null = null;
  private r2BaseUrl = '';

  private _state$ = new BehaviorSubject<DrussSession>({ ...DEFAULT_SESSION });
  readonly state$ = this._state$.asObservable();

  constructor() {
    this.catalogService.getR2BaseUrl().pipe(take(1)).subscribe(url => this.r2BaseUrl = url);
    this.audio.ended$.pipe(takeUntil(this.destroy$)).subscribe(() => this.onAudioEnded());
    this.audio.error$.pipe(takeUntil(this.destroy$)).subscribe(err => console.error(err));
  }

  getState(): DrussSession {
    return this._state$.getValue();
  }

  start(config: SessionConfig, detail: KhassidaDetail): void {
    this.detail = detail;
    this.audio.setPlaybackRate(config.playbackRate);

    this._state$.next({
      ...DEFAULT_SESSION,
      config,
      currentVers: config.startVers,
      currentLoopPass: 1,
      ...this.repeatInfo(config.startVers),
    });

    this.playCurrentSegment();
  }

  togglePlayPause(): void {
    const state = this.getState();
    if (state.isComplete) return;
    if (state.isPlaying) {
      this.audio.pause();
      this._state$.next({ ...state, isPlaying: false, isPaused: true });
    } else {
      this.audio.resume();
      this._state$.next({ ...state, isPlaying: true, isPaused: false });
    }
  }

  previous(): void {
    const state = this.getState();
    if (state.isComplete) return;

    const { config, currentVers, currentXaab, currentLoopPass } = state;

    if (config.playbackMode === 'boucle') {
      if (currentVers > config.startVers) {
        this.goToSegment(currentVers - 1, 1, 1, currentLoopPass);
      } else if (currentLoopPass > 1) {
        this.goToSegment(config.endVers, 1, 1, currentLoopPass - 1);
      }
      return;
    }

    if (config.playbackMode === 'xaab') {
      if (currentXaab === 2) {
        this.goToSegment(currentVers, 1, 1, currentLoopPass);
      } else if (currentVers > config.startVers) {
        this.goToSegment(currentVers - 1, 1, 1, currentLoopPass);
      }
    } else {
      if (currentVers > config.startVers) {
        this.goToSegment(currentVers - 1, 1, 1, currentLoopPass);
      }
    }
  }

  next(): void {
    const state = this.getState();
    if (state.isComplete) return;
    this.advance(true);
  }

  setPlaybackRate(rate: number): void {
    this.audio.setPlaybackRate(rate);
    const state = this.getState();
    this._state$.next({ ...state, config: { ...state.config, playbackRate: rate } });
  }

  /**
   * Change le daadj (style de sonorisation) à la volée. Le segment courant
   * est rejoué depuis le début dans le nouveau style ; l'état lecture/pause
   * est préservé.
   */
  setDaadj(daadjId: string): void {
    const state = this.getState();
    if (!state.config.khassidaId || state.config.daadjId === daadjId) return;

    const wasPaused = state.isPaused;
    this._state$.next({ ...state, config: { ...state.config, daadjId } });

    if (!this.detail) return;
    this.audio.stop();
    this.playCurrentSegment();
    if (wasPaused) {
      this.audio.pause();
      const s = this.getState();
      this._state$.next({ ...s, isPlaying: false, isPaused: true });
    }
  }

  stop(): void {
    this.audio.stop();
    this._state$.next({ ...DEFAULT_SESSION });
    this.detail = null;
  }

  private playCurrentSegment(): void {
    const state = this.getState();
    if (!this.detail) return;
    const url = this.buildUrl(state.currentVers, state.currentXaab);
    this.audio.play(url);
    this._state$.next({ ...state, isPlaying: true, isPaused: false });

    // Précharge le prochain segment pour un enchaînement sans coupure
    const next = this.computeNext(state, false);
    if (next) {
      this.audio.preload(this.buildUrl(next.vers, next.xaab));
    }
  }

  private onAudioEnded(): void {
    this.advance(false);
  }

  /**
   * Calcule la prochaine position (pure, ne modifie pas l'état).
   * Retourne null si la séance est terminée.
   */
  private computeNext(
    state: DrussSession,
    skip: boolean,
  ): { vers: number; xaab: number; repetition: number; loopPass: number } | null {
    if (!this.detail) return null;
    const { config, currentVers, currentXaab, currentRepetition, currentLoopPass } = state;
    const xaabMax = this.detail.xaab_per_vers;

    if (config.playbackMode === 'boucle') {
      if (currentXaab < xaabMax) return { vers: currentVers, xaab: currentXaab + 1, repetition: 1, loopPass: currentLoopPass };
      if (currentVers < config.endVers) return { vers: currentVers + 1, xaab: 1, repetition: 1, loopPass: currentLoopPass };
      if (!skip && currentLoopPass < config.repetitions) return { vers: config.startVers, xaab: 1, repetition: 1, loopPass: currentLoopPass + 1 };
      return null;
    }

    if (config.playbackMode === 'vers') {
      if (currentXaab < xaabMax) return { vers: currentVers, xaab: currentXaab + 1, repetition: currentRepetition, loopPass: currentLoopPass };
      if (!skip && currentRepetition < config.repetitions) return { vers: currentVers, xaab: 1, repetition: currentRepetition + 1, loopPass: currentLoopPass };
    }

    if (config.playbackMode === 'xaab') {
      if (!skip && currentRepetition < config.repetitions) return { vers: currentVers, xaab: currentXaab, repetition: currentRepetition + 1, loopPass: currentLoopPass };
      if (currentXaab < xaabMax) return { vers: currentVers, xaab: currentXaab + 1, repetition: 1, loopPass: currentLoopPass };
    }

    // Vers suivant (commun à 'vers' et 'xaab')
    if (currentVers < config.endVers) return { vers: currentVers + 1, xaab: 1, repetition: 1, loopPass: currentLoopPass };
    return null;
  }

  private advance(skip: boolean): void {
    const state = this.getState();
    if (!this.detail) return;

    const next = this.computeNext(state, skip);
    if (next) {
      this.goToSegment(next.vers, next.xaab, next.repetition, next.loopPass);
    } else {
      this.audio.stop();
      this._state$.next({ ...state, isPlaying: false, isPaused: false, isComplete: true });
    }
  }

  private goToSegment(vers: number, xaab: number, repetition: number, loopPass: number): void {
    const state = this.getState();
    this._state$.next({
      ...state,
      currentVers: vers,
      currentXaab: xaab,
      currentRepetition: repetition,
      currentLoopPass: loopPass,
      ...this.repeatInfo(vers),
    });
    this.playCurrentSegment();
  }

  private repeatInfo(vers: number): { isRepeat: boolean; repeatOf: number | null } {
    if (!this.detail) return { isRepeat: false, repeatOf: null };
    const repeat = this.detail.repeats?.find(r => r.audioVers === vers);
    return repeat
      ? { isRepeat: true, repeatOf: repeat.originalVers }
      : { isRepeat: false, repeatOf: null };
  }

  private buildUrl(vers: number, xaab: number): string {
    const { khassidaId, daadjId } = this.getState().config;
    const v = String(vers).padStart(3, '0');
    const x = String(xaab).padStart(2, '0');
    return `${this.r2BaseUrl}/${daadjId}/${khassidaId}/${v}_x${x}.mp3`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.audio.stop();
  }
}
