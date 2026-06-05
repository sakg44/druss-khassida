import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Lecture audio quasi sans couture via deux éléments <audio> :
 * pendant qu'un segment joue, le suivant est préchargé sur l'élément
 * inactif. À la fin, on bascule instantanément (pas de latence réseau).
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private a = new Audio();
  private b = new Audio();
  private active: HTMLAudioElement;
  private idle: HTMLAudioElement;

  readonly ended$ = new Subject<void>();
  readonly error$ = new Subject<string>();

  private _isPlaying = false;
  private _currentUrl = '';
  private _preloadUrl = '';
  private _rate = 1;
  private _muted = false;

  get isPlaying() { return this._isPlaying; }
  get currentUrl() { return this._currentUrl; }

  constructor() {
    this.active = this.a;
    this.idle = this.b;
    this.a.preload = 'auto';
    this.b.preload = 'auto';
    this.attach(this.a);
    this.attach(this.b);
  }

  private attach(el: HTMLAudioElement): void {
    el.addEventListener('ended', () => {
      if (el !== this.active) return;
      this._isPlaying = false;
      this.ended$.next();
    });
    el.addEventListener('error', () => {
      if (el !== this.active || !el.src) return;
      this._isPlaying = false;
      this.error$.next(`Erreur audio: ${this._currentUrl}`);
    });
    el.addEventListener('playing', () => { if (el === this.active) this._isPlaying = true; });
    el.addEventListener('pause', () => { if (el === this.active) this._isPlaying = false; });
  }

  play(url: string): void {
    // Le segment demandé a déjà été préchargé → bascule instantanée
    if (url === this._preloadUrl && this.idle.src) {
      const previous = this.active;
      this.active = this.idle;
      this.idle = previous;
      this._preloadUrl = '';

      previous.pause();
      try { this.active.currentTime = 0; } catch {}
      this.active.playbackRate = this._rate;
      this.active.muted = this._muted;
      this._currentUrl = url;
      this.active.play().catch(() => this.error$.next(`Impossible de lire: ${url}`));
      return;
    }

    if (this._currentUrl !== url) {
      this.active.src = url;
      this._currentUrl = url;
    }
    try { this.active.currentTime = 0; } catch {}
    this.active.playbackRate = this._rate;
    this.active.muted = this._muted;
    this.active.play().catch(() => this.error$.next(`Impossible de lire: ${url}`));
  }

  /** Précharge le prochain segment sur l'élément inactif. */
  preload(url: string): void {
    if (!url || url === this._preloadUrl || url === this._currentUrl) return;
    this._preloadUrl = url;
    this.idle.src = url;
    this.idle.playbackRate = this._rate;
    this.idle.muted = this._muted;
    this.idle.load();
  }

  pause(): void { this.active.pause(); }
  resume(): void { this.active.play().catch(() => {}); }

  stop(): void {
    this.active.pause();
    try { this.active.currentTime = 0; } catch {}
    this.idle.pause();
    this._currentUrl = '';
    this._preloadUrl = '';
    this._isPlaying = false;
  }

  setPlaybackRate(rate: number): void {
    this._rate = rate;
    this.active.playbackRate = rate;
    this.idle.playbackRate = rate;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    this.active.muted = muted;
    this.idle.muted = muted;
  }
}
