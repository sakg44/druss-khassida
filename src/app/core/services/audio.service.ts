import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private audio = new Audio();
  readonly ended$ = new Subject<void>();
  readonly error$ = new Subject<string>();

  private _isPlaying = false;
  private _currentUrl = '';

  get isPlaying() { return this._isPlaying; }
  get currentUrl() { return this._currentUrl; }

  constructor() {
    this.audio.addEventListener('ended', () => {
      this._isPlaying = false;
      this.ended$.next();
    });
    this.audio.addEventListener('error', () => {
      this._isPlaying = false;
      this.error$.next(`Erreur audio: ${this._currentUrl}`);
    });
    this.audio.addEventListener('playing', () => {
      this._isPlaying = true;
    });
    this.audio.addEventListener('pause', () => {
      this._isPlaying = false;
    });
  }

  play(url: string): void {
    if (this._currentUrl !== url) {
      this.audio.src = url;
      this._currentUrl = url;
    }
    this.audio.play().catch(() => this.error$.next(`Impossible de lire: ${url}`));
  }

  pause(): void {
    this.audio.pause();
  }

  resume(): void {
    this.audio.play().catch(() => {});
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this._currentUrl = '';
    this._isPlaying = false;
  }

  setPlaybackRate(rate: number): void {
    this.audio.playbackRate = rate;
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted;
  }
}
