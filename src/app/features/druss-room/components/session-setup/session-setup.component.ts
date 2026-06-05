import { Component, Input, Output, EventEmitter, signal, computed, OnInit } from '@angular/core';

import { KhassidaInfo, KhassidaDetail } from '../../../../core/models/khassida.model';
import { SessionConfig, REPETITION_OPTIONS, PLAYBACK_RATE_OPTIONS, PlaybackMode } from '../../../../core/models/druss-session.model';

@Component({
  selector: 'app-session-setup',
  standalone: true,
  imports: [],
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }

    /* ── Mode cards ───────────────────────── */
    .mode-card {
      display: flex; align-items: center; gap: 1rem;
      padding: 1rem 1.1rem;
      border: 1px solid var(--c-border);
      border-radius: 6px;
      cursor: pointer;
      background: transparent;
      text-align: left;
      transition: border-color .2s, background .2s, transform .12s;
      width: 100%;
      position: relative;
      overflow: hidden;
    }
    .mode-card::before {
      content: '';
      position: absolute; left: 0; top: 0; bottom: 0;
      width: 3px;
      background: var(--c-accent);
      transform: scaleY(0);
      transition: transform .2s cubic-bezier(.16,1,.3,1);
      transform-origin: center;
    }
    .mode-card.active {
      border-color: var(--c-accent);
      background: var(--c-accent-bg);
    }
    .mode-card.active::before { transform: scaleY(1); }
    .mode-card:not(.active):hover {
      border-color: color-mix(in srgb, var(--c-accent) 40%, transparent);
      transform: translateX(2px);
    }
    .mode-icon {
      width: 40px; height: 40px; shrink: 0;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      background: var(--c-border);
      color: var(--c-text-3);
      transition: background .2s, color .2s;
      flex-shrink: 0;
    }
    .mode-card.active .mode-icon {
      background: color-mix(in srgb, var(--c-accent) 18%, transparent);
      color: var(--c-accent);
    }

    /* ── Range bar ────────────────────────── */
    .range-track {
      height: 4px; border-radius: 2px;
      background: var(--c-border);
      position: relative; overflow: hidden;
    }
    .range-fill {
      position: absolute; top: 0; bottom: 0;
      background: linear-gradient(90deg, var(--c-accent-2), var(--c-accent));
      border-radius: 2px;
      transition: left .2s, width .2s;
    }

    /* ── Rep circles ──────────────────────── */
    .rep-circle {
      flex: 1; aspect-ratio: 1; max-width: 56px;
      border-radius: 50%;
      border: 1.5px solid var(--c-border);
      background: transparent;
      cursor: pointer;
      font-family: 'Cinzel', serif;
      font-size: 0.85rem;
      color: var(--c-text-3);
      display: flex; align-items: center; justify-content: center;
      transition: all .15s;
    }
    .rep-circle:hover { border-color: var(--c-accent); color: var(--c-accent); }
    .rep-circle.active {
      background: var(--c-accent);
      border-color: var(--c-accent);
      color: #fff;
      transform: scale(1.08);
    }

    /* ── Speed segmented ──────────────────── */
    .speed-seg {
      flex: 1;
      padding: .35rem 0;
      border: none;
      background: transparent;
      cursor: pointer;
      font-family: 'Cormorant Garamond', serif;
      font-size: 0.8rem;
      color: var(--c-text-3);
      transition: all .15s;
      border-bottom: 2px solid transparent;
    }
    .speed-seg:hover { color: var(--c-text-1); }
    .speed-seg.active {
      color: var(--c-accent);
      border-bottom-color: var(--c-accent);
      font-weight: 600;
    }

    /* ── Sticky footer ────────────────────── */
    .setup-footer {
      position: sticky; bottom: 0;
      background: color-mix(in srgb, var(--c-bg) 95%, transparent);
      backdrop-filter: blur(8px);
      border-top: 1px solid var(--c-border);
      padding: .85rem 1.25rem;
      margin: 0 -1rem;
    }

    /* ── Range stepper ────────────────────── */
    .range-stepper {
      width: 36px; height: 36px;
      border: 1px solid var(--c-border);
      background: transparent;
      border-radius: 4px;
      color: var(--c-text-3);
      cursor: pointer;
      font-size: 1.1rem;
      display: flex; align-items: center; justify-content: center;
      transition: all .15s;
    }
    .range-stepper:not(:disabled):hover {
      border-color: var(--c-accent); color: var(--c-accent);
    }
    .range-stepper:disabled { opacity: 0.25; cursor: not-allowed; }

    @keyframes fadeUp {
      from { opacity:0; transform: translateY(12px); }
      to   { opacity:1; transform: translateY(0); }
    }
    .fade-up { animation: fadeUp .4s cubic-bezier(.16,1,.3,1) both; }
  `],
  template: `
    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto px-4 pt-6 pb-2 flex flex-col gap-7">

      <!-- Khassida header -->
      <div class="text-center fade-up" style="animation-delay:.05s">
        @if (info.nomAr) {
          <p class="font-arabic text-3xl c-text-1 mb-1" dir="rtl" style="font-weight:700; line-height:1.3">
            {{ info.nomAr }}
          </p>
        }
        <p class="font-display text-[10px] tracking-[.22em] uppercase c-text-3">{{ info.nom }}</p>
        <div class="green-rule max-w-[100px] mx-auto mt-3">
          <span class="c-accent" style="font-size:.45rem; opacity:.5">◆</span>
        </div>
        <p class="font-serif c-text-3 mt-2" style="font-size:.85rem">
          {{ detail.nb_vers }} abyāt
          @if (detail.audio_vers && detail.audio_vers !== detail.nb_vers) {
            · {{ detail.audio_vers }} segments
          }
        </p>
      </div>

      <!-- ── 1. MODE ── -->
      <section class="flex flex-col gap-2 fade-up" style="animation-delay:.1s">
        <p class="font-display text-[9px] tracking-[.25em] uppercase c-text-3 mb-1">Mode de lecture</p>

        <!-- Boucle -->
        <button class="mode-card" [class.active]="playbackMode() === 'boucle'" (click)="playbackMode.set('boucle')">
          <div class="mode-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
              <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-display text-xs tracking-wider uppercase c-text-1 mb-0.5">Boucle</p>
            <p class="font-serif c-text-3 leading-snug" style="font-size:.78rem">
              Toute la plage du début à la fin · recommence N fois
            </p>
          </div>
          @if (playbackMode() === 'boucle') {
            <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--c-accent)">
              <circle cx="8" cy="8" r="8" opacity=".2"/>
              <path d="M5 8l2.5 2.5L11 5.5" stroke="var(--c-accent)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            </svg>
          }
        </button>

        <div class="grid grid-cols-2 gap-2">
          <!-- Vers entier -->
          <button class="mode-card" [class.active]="playbackMode() === 'vers'" (click)="playbackMode.set('vers')">
            <div class="mode-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-display text-xs tracking-wider uppercase c-text-1 mb-0.5">Vers</p>
              <p class="font-serif c-text-3" style="font-size:.75rem">Bayt × N fois</p>
            </div>
          </button>

          <!-- Xaab -->
          <button class="mode-card" [class.active]="playbackMode() === 'xaab'" (click)="playbackMode.set('xaab')">
            <div class="mode-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="14" x2="14" y2="14"/>
                <circle cx="19" cy="14" r="2" fill="currentColor" stroke="none" opacity=".6"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-display text-xs tracking-wider uppercase c-text-1 mb-0.5">Xaab</p>
              <p class="font-serif c-text-3" style="font-size:.75rem">Ligne × N fois</p>
            </div>
          </button>
        </div>
      </section>

      <!-- ── 2. PLAGE ── -->
      <section class="flex flex-col gap-3 fade-up" style="animation-delay:.15s">
        <div class="flex items-center justify-between">
          <p class="font-display text-[9px] tracking-[.25em] uppercase c-text-3">Plage de vers</p>
          <p class="font-serif c-text-2" style="font-size:.82rem">
            {{ versCount() }} abyāt
          </p>
        </div>

        <!-- Visual range bar -->
        <div class="range-track">
          <div class="range-fill"
            [style.left.%]="rangeLeft()"
            [style.width.%]="rangeWidth()">
          </div>
        </div>

        <!-- Controls -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <button class="range-stepper" (click)="decrement('start')" [disabled]="startVers() <= 1">−</button>
            <span class="font-display text-xl c-text-1 w-10 text-center">{{ startVers() }}</span>
            <button class="range-stepper" (click)="increment('start')" [disabled]="startVers() >= endVers()">+</button>
          </div>

          <div class="flex items-center gap-1 c-text-3">
            <div class="h-px w-4" style="background:var(--c-border)"></div>
            <span class="font-serif" style="font-size:.7rem; opacity:.5">→</span>
            <div class="h-px w-4" style="background:var(--c-border)"></div>
          </div>

          <div class="flex items-center gap-2">
            <button class="range-stepper" (click)="decrement('end')" [disabled]="endVers() <= startVers()">−</button>
            <span class="font-display text-xl c-text-1 w-10 text-center">{{ endVers() }}</span>
            <button class="range-stepper" (click)="increment('end')" [disabled]="endVers() >= maxVers">+</button>
          </div>
        </div>

        <!-- Quick picks -->
        <div class="flex gap-2 mt-1">
          <button (click)="setRange(1, maxVers)"
            class="font-display text-[9px] tracking-wider uppercase px-2.5 py-1 rounded-sm transition-all"
            [style.background]="startVers()===1 && endVers()===maxVers ? 'var(--c-accent-bg)' : 'var(--c-muted)'"
            [style.color]="startVers()===1 && endVers()===maxVers ? 'var(--c-accent)' : 'var(--c-text-3)'"
            style="border:1px solid var(--c-border)">
            Tout
          </button>
          <button (click)="setRange(1, Math.min(10, maxVers))"
            class="font-display text-[9px] tracking-wider uppercase px-2.5 py-1 rounded-sm transition-all"
            [style.background]="startVers()===1 && endVers()===Math.min(10,maxVers) ? 'var(--c-accent-bg)' : 'var(--c-muted)'"
            [style.color]="startVers()===1 && endVers()===Math.min(10,maxVers) ? 'var(--c-accent)' : 'var(--c-text-3)'"
            style="border:1px solid var(--c-border)">
            1 – 10
          </button>
          <button (click)="setRange(1, Math.min(20, maxVers))"
            class="font-display text-[9px] tracking-wider uppercase px-2.5 py-1 rounded-sm transition-all"
            [style.background]="startVers()===1 && endVers()===Math.min(20,maxVers) ? 'var(--c-accent-bg)' : 'var(--c-muted)'"
            [style.color]="startVers()===1 && endVers()===Math.min(20,maxVers) ? 'var(--c-accent)' : 'var(--c-text-3)'"
            style="border:1px solid var(--c-border)">
            1 – 20
          </button>
        </div>
      </section>

      <!-- ── 3. RÉPÉTITIONS ── -->
      <section class="flex flex-col gap-3 fade-up" style="animation-delay:.2s">
        <div class="flex items-center justify-between">
          <p class="font-display text-[9px] tracking-[.25em] uppercase c-text-3">
            {{ playbackMode() === 'boucle' ? 'Passages' : 'Répétitions' }}
          </p>
          @if (playbackMode() === 'boucle') {
            <p class="font-serif c-text-3" style="font-size:.78rem">
              {{ versCount() * repetitions() }} segments au total
            </p>
          }
        </div>
        <div class="flex gap-3 justify-center">
          @for (n of repOptions; track n) {
            <button class="rep-circle" [class.active]="repetitions() === n" (click)="repetitions.set(n)">
              {{ n }}×
            </button>
          }
        </div>
      </section>

      <!-- ── 4. VITESSE ── -->
      <section class="flex flex-col gap-2 fade-up pb-2" style="animation-delay:.25s">
        <p class="font-display text-[9px] tracking-[.25em] uppercase c-text-3">Vitesse</p>
        <div class="flex" style="border-bottom: 1px solid var(--c-border)">
          @for (r of rateOptions; track r) {
            <button class="speed-seg" [class.active]="playbackRate() === r" (click)="playbackRate.set(r)">
              {{ r }}×
            </button>
          }
        </div>
      </section>

    </div>

    <!-- ── Sticky footer / CTA ── -->
    <div class="setup-footer">
      <!-- Session summary -->
      <div class="flex items-center gap-2 mb-3">
        <div class="flex-1 flex items-center gap-1.5 flex-wrap">
          <span class="font-display text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-sm c-accent"
                style="background:var(--c-accent-bg); border:1px solid var(--c-accent); opacity:.9">
            {{ modeLabel() }}
          </span>
          <span class="font-serif c-text-3" style="font-size:.78rem">
            vers {{ startVers() }}–{{ endVers() }}
          </span>
          <span class="c-text-3" style="font-size:.6rem; opacity:.4">·</span>
          <span class="font-serif c-text-3" style="font-size:.78rem">
            {{ repetitions() }}× · {{ playbackRate() }}×
          </span>
        </div>
      </div>

      <button (click)="onStart()"
        class="w-full flex items-center justify-center gap-3 font-display text-sm tracking-[.18em] uppercase transition-all active:scale-[.98]"
        style="background:linear-gradient(135deg, var(--c-accent-2), var(--c-accent)); color:#fff; border-radius:4px; padding:.9rem 1rem; box-shadow: 0 4px 20px color-mix(in srgb, var(--c-accent) 30%, transparent)">
        <svg width="15" height="15" viewBox="0 0 18 18" fill="currentColor" style="margin-left:2px; opacity:.9">
          <path d="M4 2.5l12 6.5-12 6.5V2.5z"/>
        </svg>
        Entrer en druss
      </button>
    </div>
  `,
})
export class SessionSetupComponent implements OnInit {
  @Input() info!: KhassidaInfo;
  @Input() detail!: KhassidaDetail;
  @Output() started = new EventEmitter<SessionConfig>();

  repOptions  = REPETITION_OPTIONS;
  rateOptions = PLAYBACK_RATE_OPTIONS;
  Math = Math;

  startVers    = signal(1);
  endVers      = signal(10);
  repetitions  = signal(3);
  playbackMode = signal<PlaybackMode>('boucle');
  playbackRate = signal(1);

  versCount = computed(() => this.endVers() - this.startVers() + 1);

  rangeLeft  = computed(() => ((this.startVers() - 1) / this.maxVers) * 100);
  rangeWidth = computed(() => (this.versCount() / this.maxVers) * 100);

  modeLabel = computed(() => ({
    boucle: 'Boucle', vers: 'Vers', xaab: 'Xaab'
  }[this.playbackMode()]));

  get maxVers(): number { return this.detail.audio_vers ?? this.detail.nb_vers; }

  ngOnInit(): void { this.endVers.set(Math.min(10, this.maxVers)); }

  decrement(w: 'start' | 'end'): void {
    if (w === 'start' && this.startVers() > 1)              this.startVers.update(v => v - 1);
    if (w === 'end'   && this.endVers() > this.startVers()) this.endVers.update(v => v - 1);
  }
  increment(w: 'start' | 'end'): void {
    if (w === 'start' && this.startVers() < this.endVers()) this.startVers.update(v => v + 1);
    if (w === 'end'   && this.endVers() < this.maxVers)     this.endVers.update(v => v + 1);
  }

  setRange(start: number, end: number): void {
    this.startVers.set(start);
    this.endVers.set(Math.min(end, this.maxVers));
  }

  onStart(): void {
    this.started.emit({
      khassidaId: this.info.id, startVers: this.startVers(), endVers: this.endVers(),
      repetitions: this.repetitions(), playbackMode: this.playbackMode(), playbackRate: this.playbackRate(),
    });
  }
}
