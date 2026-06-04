import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-druss-room',
  standalone: true,
  imports: [CommonModule, RouterModule, SessionSetupComponent, PdfViewerComponent, AudioControlsComponent, ProgressTrackComponent],
  template: `
    <div class="h-screen flex flex-col overflow-hidden c-bg">

      <!-- ── Header ── -->
      <header class="app-header shrink-0 flex items-center gap-2 px-4 py-2.5 z-10">
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
          <p class="font-display text-[9px] tracking-[0.18em] uppercase c-text-2">Salon de druss</p>
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
            <app-pdf-viewer [pdfUrl]="info()!.pdfUrl" class="h-full block" />
          </div>

          <div class="shrink-0 player-bar px-4 pt-3 pb-4 flex flex-col gap-2.5">
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
            <app-pdf-viewer [pdfUrl]="info()!.pdfUrl" class="h-full block" />
          </div>
          <div class="w-72 shrink-0 flex flex-col justify-center gap-8 p-6 overflow-y-auto">
            <app-progress-track [session]="session()!" [totalVers]="detail()!.nb_vers" />
            <app-audio-controls
              [session]="session()!" [isMuted]="isMuted()"
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
          <div class="max-w-xs w-full text-center flex flex-col items-center gap-6 anim-in">
            <div class="green-rule w-full max-w-[200px]">
              <span class="c-accent" style="font-size:0.6rem">◆</span>
            </div>
            <div>
              <p class="font-display text-xs tracking-[0.25em] uppercase mb-3 c-accent">Séance accomplie</p>
              <p class="font-arabic text-3xl mb-2 c-text-1" dir="rtl">{{ info()?.nomAr }}</p>
              <p class="font-serif text-sm c-text-3" style="font-size:0.9rem">
                Vers {{ session()!.config.startVers }} – {{ session()!.config.endVers }} ·
                {{ session()!.config.repetitions }}
                {{ session()!.config.playbackMode === 'boucle' ? 'passage' : 'répétition' }}{{ session()!.config.repetitions > 1 ? 's' : '' }}
              </p>
            </div>
            <div class="green-rule w-full max-w-[200px]">
              <span class="c-accent" style="font-size:0.6rem">◆</span>
            </div>
            <div class="flex flex-col gap-3 w-full">
              <button (click)="restartSession()"
                      class="w-full py-3 font-display text-xs tracking-[0.18em] uppercase transition-all hover:opacity-90 active:scale-95"
                      style="background:linear-gradient(135deg, var(--c-accent-2), var(--c-accent)); color:#fff; border-radius:3px">
                Rejouer
              </button>
              <button (click)="exitSession()"
                      class="w-full py-3 font-display text-xs tracking-[0.18em] uppercase transition-all rep-btn">
                Nouvelle séance
              </button>
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
    this.sessionService.start(config, detail, info.metrique);
  }

  exitSession(): void {
    this.sessionService.stop();
    this.audioService.setMuted(false);
    this.isMuted.set(false);
    this.releaseWakeLock();
    this.view.set('setup');
  }

  restartSession(): void {
    const s = this.session(), d = this.detail(), i = this.info();
    if (!s || !d || !i) return;
    this.sessionService.start(s.config, d, i.metrique);
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
