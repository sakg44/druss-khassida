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
  private metrique = '';

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

  start(config: SessionConfig, detail: KhassidaDetail, metrique: string): void {
    this.detail = detail;
    this.metrique = metrique;
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

  stop(): void {
    this.audio.stop();
    this._state$.next({ ...DEFAULT_SESSION });
    this.detail = null;
  }

  private playCurrentSegment(): void {
    const state = this.getState();
    if (!this.detail) return;
    const url = this.buildUrl(state.config.khassidaId, state.currentVers, state.currentXaab);
    this.audio.play(url);
    this._state$.next({ ...state, isPlaying: true, isPaused: false });
  }

  private onAudioEnded(): void {
    this.advance(false);
  }

  private advance(skip: boolean): void {
    const state = this.getState();
    if (!this.detail) return;

    const { config, currentVers, currentXaab, currentRepetition, currentLoopPass } = state;

    // --- Mode boucle : toute la plage joue en séquence, puis recommence ---
    if (config.playbackMode === 'boucle') {
      if (currentXaab < this.detail.xaab_per_vers) {
        this.goToSegment(currentVers, currentXaab + 1, 1, currentLoopPass);
        return;
      }
      if (currentVers < config.endVers) {
        this.goToSegment(currentVers + 1, 1, 1, currentLoopPass);
        return;
      }
      // Fin du passage
      if (!skip && currentLoopPass < config.repetitions) {
        this.goToSegment(config.startVers, 1, 1, currentLoopPass + 1);
      } else {
        this.audio.stop();
        this._state$.next({ ...state, isPlaying: false, isPaused: false, isComplete: true });
      }
      return;
    }

    // --- Mode vers (bayt entier répété N fois) ---
    if (config.playbackMode === 'vers') {
      if (currentXaab < this.detail.xaab_per_vers) {
        this.goToSegment(currentVers, currentXaab + 1, currentRepetition, currentLoopPass);
        return;
      }
      if (!skip && currentRepetition < config.repetitions) {
        this.goToSegment(currentVers, 1, currentRepetition + 1, currentLoopPass);
        return;
      }
    }

    // --- Mode xaab (chaque ligne répétée N fois) ---
    if (config.playbackMode === 'xaab') {
      if (!skip && currentRepetition < config.repetitions) {
        this.goToSegment(currentVers, currentXaab, currentRepetition + 1, currentLoopPass);
        return;
      }
      if (currentXaab < this.detail.xaab_per_vers) {
        this.goToSegment(currentVers, currentXaab + 1, 1, currentLoopPass);
        return;
      }
    }

    // Vers suivant (commun à 'vers' et 'xaab')
    if (currentVers < config.endVers) {
      this.goToSegment(currentVers + 1, 1, 1, currentLoopPass);
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

  private buildUrl(id: string, vers: number, xaab: number): string {
    const v = String(vers).padStart(3, '0');
    const x = String(xaab).padStart(2, '0');
    return `${this.r2BaseUrl}/${this.metrique}/${id}/${v}_x${x}.mp3`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.audio.stop();
  }
}
