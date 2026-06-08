import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';

import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, takeUntil, switchMap, combineLatest } from 'rxjs';

import { CatalogService } from '../../core/services/catalog.service';
import { KhassidaService } from '../../core/services/khassida.service';
import { SessionService } from '../../core/services/session.service';
import { AudioService } from '../../core/services/audio.service';
import { ThemeService } from '../../core/services/theme.service';

import { KhassidaInfo, KhassidaDetail } from '../../core/models/khassida.model';
import { DrussSession, SessionConfig, SessionView, PLAYBACK_RATE_OPTIONS } from '../../core/models/druss-session.model';

import { SessionSetupComponent } from './components/session-setup/session-setup.component';
import { PdfViewerComponent } from './components/pdf-viewer/pdf-viewer.component';
import { AudioControlsComponent } from './components/audio-controls/audio-controls.component';
import { ProgressTrackComponent } from './components/progress-track/progress-track.component';
import { DaadjSelectorComponent } from './components/daadj-selector/daadj-selector.component';

@Component({
  selector: 'app-druss-room',
  standalone: true,
  imports: [RouterModule, SessionSetupComponent, PdfViewerComponent, AudioControlsComponent, ProgressTrackComponent, DaadjSelectorComponent],
  template: `
    <div class="h-screen flex flex-col overflow-hidden c-bg">

      <!-- ── Header ── -->
      <header class="app-header shrink-0 flex items-center gap-2 px-4 py-2.5 z-10"
              style="padding-top: max(0.625rem, env(safe-area-inset-top)); padding-right: max(1rem, env(safe-area-inset-right))">
        <a routerLink="/" class="btn-nav w-8 h-8">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M9 1L3 6l6 5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          </svg>
        </a>

        <div class="flex-1 min-w-0">
          @if (info()?.nomAr) {
            <p class="font-arabic truncate leading-tight c-text-1" dir="rtl" style="font-size:1.05rem">{{ info()!.nomAr }}</p>
          } @else {
            <p class="font-display text-xs tracking-widest uppercase truncate c-text-3">{{ info()?.nom }}</p>
          }
          <p class="font-display text-[9px] tracking-[0.18em] uppercase c-text-2">
            Salon de druss@if (currentDaadj()?.kurel) { · {{ currentDaadj()!.kurel }} }
          </p>
        </div>

        <button class="theme-btn" (click)="themeService.toggle()" [title]="themeService.isDark() ? 'Mode clair' : 'Mode sombre'">
          @if (themeService.isDark()) {
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/>
            </svg>
          } @else {
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            </svg>
          }
        </button>

        @if (view() === 'active') {
          <button (click)="exitSession()" class="speed-chip">Quitter</button>
        }
      </header>

      <!-- ── Loading ── -->
      @if (loading()) {
        <div class="flex-1 flex items-center justify-center">
          <div class="spinner"></div>
        </div>
      }

      <!-- ── Setup ── -->
      @if (!loading() && view() === 'setup' && info() && detail()) {
        <div class="flex-1 overflow-y-auto px-4">
          <app-session-setup [info]="info()!" [detail]="detail()!" (started)="onSessionStart($event)" />
        </div>
      }

      <!-- ── Active ── -->
      @if (!loading() && view() === 'active' && session() && info() && detail()) {

        <!-- MOBILE -->
        <div class="flex-1 min-h-0 flex flex-col lg:hidden overflow-hidden">
          <div class="flex-1 min-h-0 p-2">
            <app-pdf-viewer
              [pdfUrl]="info()!.pdfUrl"
              [targetPage]="currentPdfPage()"
              [highlightZone]="currentZone()"
              [annotated]="hasAnnotations()"
              class="h-full block" />
          </div>

          <div class="shrink-0 player-bar px-4 pt-3 pb-4 flex flex-col gap-2.5">
            <!-- Daadj (style de sonorisation) -->
            @if (info()!.daajs.length > 1) {
              <app-daadj-selector class="self-center"
                [daajs]="info()!.daajs"
                [selected]="session()!.config.daadjId"
                (select)="sessionService.setDaadj($event)" />
            } @else if (currentDaadj(); as d) {
              <div class="flex items-center justify-center gap-1.5 flex-wrap">
                <span class="chip chip-gold" style="padding:.18rem .5rem; font-size:.6rem">{{ d.nom }}</span>
                @if (info()!.metrique) {
                  <span class="chip" style="padding:.18rem .5rem; font-size:.6rem">{{ info()!.metrique }}</span>
                }
                <span class="font-serif c-text-3" style="font-size:.72rem">· {{ d.kurel }}</span>
              </div>
            }

            <!-- Progress bar -->
            <div class="flex items-center gap-2">
              <span class="font-display text-[9px] tracking-wider w-5 text-right shrink-0 c-text-3">{{ session()!.config.startVers }}</span>
              <div class="flex-1 progress-track">
                <div class="progress-fill" [style.width.%]="progressPercent()"></div>
              </div>
              <span class="font-display text-[9px] tracking-wider w-5 shrink-0 c-text-3">{{ session()!.config.endVers }}</span>
            </div>

            <!-- Dots -->
            <div class="flex flex-col items-center gap-1">
              <div class="flex items-center justify-center gap-1.5">
                @for (dot of repDots(); track $index) {
                  <div class="rep-dot" [class.done]="dot"></div>
                }
              </div>
              @if (session()!.config.playbackMode === 'boucle') {
                <span class="font-display text-[9px] tracking-widest uppercase c-text-3">
                  passage {{ session()!.currentLoopPass }} / {{ session()!.config.repetitions }}
                </span>
              }
            </div>

            <!-- Controls -->
            <div class="flex items-center justify-between">
              <div class="flex gap-1">
                @for (r of rateOptions; track r) {
                  <button class="speed-chip" [class.active]="session()!.config.playbackRate === r"
                          (click)="sessionService.setPlaybackRate(r)">{{ r }}×</button>
                }
              </div>

              <div class="flex items-center gap-3">
                <button class="btn-nav w-10 h-10"
                        [disabled]="session()!.currentVers <= session()!.config.startVers"
                        (click)="sessionService.previous()">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M2 2h1.5v10H2V2zm9.5 1.4L5.8 7l5.7 3.6V3.4z"/>
                  </svg>
                </button>
                <button class="btn-play w-14 h-14" [class.playing]="session()!.isPlaying"
                        (click)="sessionService.togglePlayPause()">
                  @if (session()!.isPlaying) {
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor">
                      <rect x="3" y="2" width="4" height="14" rx="1"/>
                      <rect x="11" y="2" width="4" height="14" rx="1"/>
                    </svg>
                  } @else {
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor" style="margin-left:2px">
                      <path d="M4 2.5l12 6.5-12 6.5V2.5z"/>
                    </svg>
                  }
                </button>
                <button class="btn-nav w-10 h-10"
                        [disabled]="session()!.currentVers >= session()!.config.endVers"
                        (click)="sessionService.next()">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M10.5 2H12v10h-1.5V2zM2.5 3.4l5.7 3.6-5.7 3.6V3.4z"/>
                  </svg>
                </button>
              </div>

              <button (click)="toggleMute()" class="btn-nav w-9 h-9" [style.opacity]="isMuted() ? '0.4' : '1'">
                @if (isMuted()) {
                  <svg width="13" height="13" viewBox="0 0 15 15" fill="currentColor">
                    <path d="M7 2L3 5.5H1v4h2l4 3.5V2zm5 1.5L2 13.5l-1-1L11 2.5l1 1z"/>
                  </svg>
                } @else {
                  <svg width="13" height="13" viewBox="0 0 15 15" fill="currentColor">
                    <path d="M7 2L3 5.5H1v4h2l4 3.5V2zm3.5 1.5a4 4 0 010 7l-1.1-1.1a2.5 2.5 0 000-4.8L10.5 3.5z"/>
                  </svg>
                }
              </button>
            </div>
          </div>
        </div>

        <!-- DESKTOP -->
        <div class="flex-1 min-h-0 hidden lg:flex flex-row overflow-hidden">
          <div class="flex-1 min-h-0 min-w-0 p-4" style="border-right:1px solid var(--c-border)">
            <app-pdf-viewer
              [pdfUrl]="info()!.pdfUrl"
              [targetPage]="currentPdfPage()"
              [highlightZone]="currentZone()"
              [annotated]="hasAnnotations()"
              class="h-full block" />
          </div>
          <div class="w-72 shrink-0 flex flex-col justify-center gap-8 p-6 overflow-y-auto">
            @if (info()!.daajs.length > 1) {
              <div class="flex flex-col gap-2">
                <p class="font-display text-[9px] tracking-[.25em] uppercase c-text-3">Daadj</p>
                <app-daadj-selector
                  [daajs]="info()!.daajs"
                  [selected]="session()!.config.daadjId"
                  (select)="sessionService.setDaadj($event)" />
              </div>
            }
            <app-progress-track [session]="session()!" [totalVers]="detail()!.nb_vers" />
            <app-audio-controls
              [session]="session()!" [isMuted]="isMuted()" [daadj]="currentDaadj()" [metrique]="info()!.metrique"
              (playPause)="sessionService.togglePlayPause()"
              (previous)="sessionService.previous()"
              (next)="sessionService.next()"
              (speedChange)="sessionService.setPlaybackRate($event)"
              (muteToggle)="toggleMute()"
            />
          </div>
        </div>
      }

      <!-- ── Complete ── -->
      @if (!loading() && view() === 'complete' && session()) {
        <div class="flex-1 flex items-center justify-center p-6">
          <div class="max-w-sm w-full setup-section text-center flex flex-col items-center gap-5 anim-in" style="padding:2rem 1.5rem">
            <!-- check medallion -->
            <div class="flex items-center justify-center" style="width:64px; height:64px; border-radius:50%; background:var(--c-accent-bg)">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12l5 5L20 6"/>
              </svg>
            </div>

            <div>
              <span class="chip mb-3">Séance accomplie</span>
              <p class="font-arabic c-text-1 mt-1" dir="rtl" style="font-size:2rem; font-weight:700">{{ info()?.nomAr }}</p>
            </div>

            <div class="flex items-center gap-2 flex-wrap justify-center">
              <span class="chip-muted chip">vers {{ session()!.config.startVers }}–{{ session()!.config.endVers }}</span>
              <span class="chip-muted chip">{{ session()!.config.repetitions }}× {{ session()!.config.playbackMode === 'boucle' ? 'passages' : 'répét.' }}</span>
            </div>

            <div class="flex flex-col gap-3 w-full mt-1">
              <button (click)="restartSession()" class="btn-primary w-full">
                <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" style="margin-left:1px"><path d="M4 2.5l12 6.5-12 6.5V2.5z"/></svg>
                Rejouer
              </button>
              <button (click)="exitSession()" class="btn-ghost w-full">Nouvelle séance</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class DrussRoomComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private catalogService = inject(CatalogService);
  private khassidaService = inject(KhassidaService);
  sessionService = inject(SessionService);
  private audioService = inject(AudioService);
  themeService = inject(ThemeService);

  private destroy$ = new Subject<void>();
  private wakeLock: WakeLockSentinel | null = null;

  loading = signal(true);
  view    = signal<SessionView>('setup');
  info    = signal<KhassidaInfo | null>(null);
  detail  = signal<KhassidaDetail | null>(null);
  session = signal<DrussSession | null>(null);
  isMuted = signal(false);

  rateOptions = PLAYBACK_RATE_OPTIONS;

  progressPercent = computed(() => {
    const s = this.session();
    if (!s) return 0;
    const { startVers, endVers } = s.config;
    const range = endVers - startVers;
    if (range === 0) return 100;
    return ((s.currentVers - startVers) / range) * 100;
  });

  repDots = computed(() => {
    const s = this.session();
    if (!s) return [];
    const total = s.config.repetitions;
    const current = s.config.playbackMode === 'boucle' ? s.currentLoopPass : s.currentRepetition;
    return Array.from({ length: total }, (_, i) => i < current);
  });

  // Page PDF cible selon le vers en cours
  currentPdfPage = computed(() => {
    const s = this.session(), d = this.detail();
    if (!s || !d) return null;
    return this.khassidaService.getPdfPage(d, s.currentVers);
  });

  // Zone de surbrillance du vers en cours (null si non annoté)
  // En mode xaab, la zone est découpée à la ligne en cours.
  currentZone = computed(() => {
    const s = this.session(), d = this.detail();
    if (!s || !d) return null;
    return this.khassidaService.getHighlightZone(d, s.currentVers, {
      mode: s.config.playbackMode,
      xaab: s.currentXaab,
    });
  });

  hasAnnotations = computed(() => {
    const d = this.detail();
    return d ? this.khassidaService.hasAnnotations(d) : false;
  });

  // Daadj en cours (selon la config de séance, sinon le premier disponible)
  currentDaadj = computed(() => {
    const i = this.info();
    if (!i) return null;
    const id = this.session()?.config.daadjId;
    return i.daajs.find(d => d.id === id) ?? i.daajs[0] ?? null;
  });

  ngOnInit(): void {
    this.route.params.pipe(
      takeUntil(this.destroy$),
      switchMap(params => combineLatest([
        this.catalogService.getById(params['id']),
        this.khassidaService.getDetail(params['id']),
      ]))
    ).subscribe(([info, detail]) => {
      this.info.set(info ?? null);
      this.detail.set(detail);
      this.loading.set(false);
    });

    this.sessionService.state$.pipe(takeUntil(this.destroy$)).subscribe(state => {
      this.session.set(state);
      if (state.isComplete) {
        this.view.set('complete');
        this.releaseWakeLock();
      } else if (state.isPlaying || state.isPaused) {
        this.view.set('active');
        if (state.isPlaying) this.requestWakeLock();
        else this.releaseWakeLock();
      }
    });
  }

  onSessionStart(config: SessionConfig): void {
    const detail = this.detail(), info = this.info();
    if (!detail || !info) return;
    this.view.set('active');
    this.sessionService.start(config, detail);
  }

  exitSession(): void {
    this.sessionService.stop();
    this.audioService.setMuted(false);
    this.isMuted.set(false);
    this.releaseWakeLock();
    this.view.set('setup');
  }

  restartSession(): void {
    const s = this.session(), d = this.detail();
    if (!s || !d) return;
    this.sessionService.start(s.config, d);
    this.view.set('active');
  }

  toggleMute(): void {
    const next = !this.isMuted();
    this.isMuted.set(next);
    this.audioService.setMuted(next);
  }

  private async requestWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator) || this.wakeLock) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
    } catch {}
  }

  private releaseWakeLock(): void {
    this.wakeLock?.release();
    this.wakeLock = null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.sessionService.stop();
    this.releaseWakeLock();
  }
}
