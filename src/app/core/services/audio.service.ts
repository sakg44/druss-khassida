import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Lecture audio sans couture via deux éléments <audio>.
 *
 * Pendant qu'un segment joue, le suivant est préchargé sur l'élément inactif.
 * Au lieu d'attendre l'événement `ended` (qui arrive APRÈS la fin réelle, avec
 * une latence JS de plusieurs dizaines de ms, et après le silence de bourrage
 * que l'encodeur mp3 ajoute en fin de fichier), on programme la bascule un
 * court instant AVANT la fin (`SWITCH_LEAD`). On élimine ainsi la latence et on
 * rogne le padding de fin → enchaînement perçu comme continu.
 *
 * L'événement `ended` natif sert de filet de sécurité (dernier segment, ou si
 * le timer n'a pas pu se déclencher).
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  /** Secondes avant la fin réelle où l'on bascule sur le segment suivant. */
  private static readonly SWITCH_LEAD = 0;

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

  /** Timer de bascule anticipée. */
  private switchTimer: ReturnType<typeof setTimeout> | null = null;
  /** Vrai quand le segment courant a déjà démarré via la bascule anticipée. */
  private autoSwitched = false;

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
    // Filet de sécurité : si la bascule anticipée n'a pas eu lieu.
    el.addEventListener('ended', () => {
      if (el !== this.active) return;
      this.clearSwitch();
      this._isPlaying = false;
      this.ended$.next();
    });
    el.addEventListener('error', () => {
      if (el !== this.active || !el.src) return;
      this._isPlaying = false;
      this.error$.next(`Erreur audio: ${this._currentUrl}`);
    });
    el.addEventListener('playing', () => {
      if (el !== this.active) return;
      this._isPlaying = true;
      this.armSwitch();
    });
    el.addEventListener('loadedmetadata', () => {
      if (el === this.active) this.armSwitch();
    });
    el.addEventListener('pause', () => { if (el === this.active) this._isPlaying = false; });
  }

  play(url: string): void {
    this.clearSwitch();

    // Le segment a déjà démarré tout seul via la bascule anticipée : ne pas
    // le relancer (sinon on coupe l'enchaînement qu'on vient de réussir).
    if (this.autoSwitched && url === this._currentUrl) {
      this.autoSwitched = false;
      return;
    }
    this.autoSwitched = false;

    // Segment déjà préchargé → bascule instantanée (chemin `ended` de secours).
    if (url === this._preloadUrl && this.idle.src) {
      this.swapToIdle(url);
      return;
    }

    // Lecture fraîche (première lecture, saut prev/next, changement de daadj).
    this._preloadUrl = '';
    if (this._currentUrl !== url) {
      this.active.src = url;
      this._currentUrl = url;
    }
    try { this.active.currentTime = 0; } catch {}
    this.active.playbackRate = this._rate;
    this.active.muted = this._muted;
    this.active.play().catch(() => this.error$.next(`Impossible de lire: ${url}`));
  }

  /**
   * Précharge le prochain segment sur l'élément inactif, puis arme la bascule
   * anticipée. On autorise un url identique au courant : en mode xaab une ligne
   * est répétée N fois (même fichier) — le précharger permet une bascule nette
   * à chaque répétition.
   */
  preload(url: string): void {
    if (!url) return;
    if (url !== this._preloadUrl) {
      this._preloadUrl = url;
      this.idle.src = url;
      this.idle.playbackRate = this._rate;
      this.idle.muted = this._muted;
      this.idle.load();
    }
    this.armSwitch();
  }

  pause(): void {
    this.clearSwitch();
    this.active.pause();
  }

  resume(): void {
    this.active.play().catch(() => {});
    this.armSwitch();
  }

  stop(): void {
    this.clearSwitch();
    this.autoSwitched = false;
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
    this.armSwitch(); // la durée restante en temps réel a changé
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    this.active.muted = muted;
    this.idle.muted = muted;
  }

  // ── Bascule anticipée ───────────────────────────────────────────────────

  /** (Re)programme la bascule un peu avant la fin du segment actif. */
  private armSwitch(): void {
    this.clearSwitch();
    if (!this._preloadUrl || !this.idle.src) return; // pas de suite à enchaîner
    if (this.active.paused) return;

    const dur = this.active.duration;
    if (!isFinite(dur) || dur <= 0) return; // métadonnées pas prêtes → on réarmera

    const remaining = (dur - this.active.currentTime) / this._rate;
    const delay = Math.max(0, remaining - AudioService.SWITCH_LEAD);
    this.switchTimer = setTimeout(() => this.doSwitch(), delay * 1000);
  }

  private clearSwitch(): void {
    if (this.switchTimer !== null) {
      clearTimeout(this.switchTimer);
      this.switchTimer = null;
    }
  }

  /** Bascule effective : démarre le segment préchargé et notifie l'UI. */
  private doSwitch(): void {
    this.switchTimer = null;
    if (!this._preloadUrl || !this.idle.src) return; // sécurité

    const url = this._preloadUrl;
    this.swapToIdle(url);
    this.autoSwitched = true;
    // L'UI avance (vers/xaab, surbrillance) ; SessionService rappellera play()
    // (no-op grâce à `autoSwitched`) puis preload() du segment d'après.
    this.ended$.next();
  }

  /** Permute actif/inactif, l'inactif (préchargé) devient l'actif et démarre. */
  private swapToIdle(url: string): void {
    const previous = this.active;
    this.active = this.idle;
    this.idle = previous;
    this._preloadUrl = '';

    previous.pause(); // coupe la queue (padding) du segment précédent
    try { this.active.currentTime = 0; } catch {}
    this.active.playbackRate = this._rate;
    this.active.muted = this._muted;
    this._currentUrl = url;
    this.active.play().catch(() => this.error$.next(`Impossible de lire: ${url}`));
  }
}
