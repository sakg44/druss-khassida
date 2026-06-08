import { Component, Input, Output, EventEmitter, signal, computed, OnInit } from '@angular/core';

import { KhassidaInfo, KhassidaDetail, Daadj, daadjContexte } from '../../../../core/models/khassida.model';
import { SessionConfig, REPETITION_OPTIONS, PLAYBACK_RATE_OPTIONS, PlaybackMode } from '../../../../core/models/druss-session.model';
import { DaadjSelectorComponent } from '../daadj-selector/daadj-selector.component';

@Component({
  selector: 'app-session-setup',
  standalone: true,
  imports: [DaadjSelectorComponent],
  styles: [`
    :host { display: block; height: 100%; }

    /* ── Layout ───────────────────────────── */
    .setup-wrap {
      width: 100%;
      max-width: 60rem;
      margin: 0 auto;
      padding: 1.5rem 0 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
    }
    .setup-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      align-items: start;
    }
    @media (min-width: 1024px) {
      .setup-grid { grid-template-columns: 1.05fr 1.05fr 0.9fr; }
    }
    .panel {
      border: 1px solid var(--c-border);
      border-radius: 12px;
      background: var(--c-surface);
      padding: 1.1rem 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
    }
    .panel-label {
      font-family: 'Outfit', sans-serif; font-weight: 600;
      font-size: 9px; letter-spacing: .25em; text-transform: uppercase;
      color: var(--c-text-3);
    }
    .field-label {
      font-family: 'Outfit', sans-serif; font-weight: 600;
      font-size: 8.5px; letter-spacing: .2em; text-transform: uppercase;
      color: var(--c-text-3);
    }

    /* ── Mode cards ───────────────────────── */
    .mode-card {
      display: flex; align-items: center; gap: .85rem;
      padding: .7rem .85rem;
      border: 1px solid var(--c-border);
      border-radius: 8px;
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
      transform: scaleX(0);
      transition: transform .2s cubic-bezier(.16,1,.3,1);
      transform-origin: left;
    }
    .mode-card.active { border-color: var(--c-accent); background: var(--c-accent-bg); }
    .mode-card.active::before { transform: scaleX(1); }
    .mode-card:not(.active):hover {
      border-color: color-mix(in srgb, var(--c-accent) 40%, transparent);
      transform: translateX(2px);
    }
    .mode-icon {
      width: 34px; height: 34px; border-radius: 8px;
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
    .range-track { height: 4px; border-radius: 2px; background: var(--c-border); position: relative; overflow: hidden; }
    .range-fill {
      position: absolute; top: 0; bottom: 0;
      background: linear-gradient(90deg, var(--c-accent-2), var(--c-accent));
      border-radius: 2px; transition: left .2s, width .2s;
    }
    .range-stepper {
      width: 34px; height: 34px;
      border: 1px solid var(--c-border); background: transparent; border-radius: 6px;
      color: var(--c-text-3); cursor: pointer; font-size: 1.1rem;
      display: flex; align-items: center; justify-content: center;
      transition: all .15s;
    }
    .range-stepper:not(:disabled):hover { border-color: var(--c-accent); color: var(--c-accent); }
    .range-stepper:disabled { opacity: 0.25; cursor: not-allowed; }
    .range-input {
      width: 3.4rem; text-align: center;
      background: transparent; border: 1px solid var(--c-border); border-radius: 6px;
      padding: .28rem 0;
      font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1rem;
      color: var(--c-text-1);
      -moz-appearance: textfield; appearance: textfield;
    }
    .range-input:focus { outline: none; border-color: var(--c-accent); background: var(--c-accent-bg); }
    .range-input::-webkit-outer-spin-button,
    .range-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .quick-pick {
      font-family: 'Outfit', sans-serif; font-weight: 600;
      font-size: 9px; letter-spacing: .06em; text-transform: uppercase;
      padding: .3rem .55rem; border-radius: 5px; border: 1px solid var(--c-border);
      cursor: pointer; transition: all .15s;
    }

    /* ── Rep circles ──────────────────────── */
    .rep-circle {
      flex: 1; aspect-ratio: 1; max-width: 48px;
      border-radius: 50%;
      border: 1.5px solid var(--c-border-2);
      background: var(--c-surface);
      cursor: pointer;
      font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 0.82rem;
      color: var(--c-text-2);
      display: flex; align-items: center; justify-content: center;
      transition: all .15s;
    }
    .rep-circle:hover { border-color: var(--c-accent); color: var(--c-accent); }
    .rep-circle.active { background: var(--c-accent); border-color: var(--c-accent); color: #fff; transform: scale(1.08); }

    /* ── Speed segmented ──────────────────── */
    .speed-seg {
      flex: 1; padding: .35rem 0;
      border: none; background: transparent; cursor: pointer;
      font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 0.8rem;
      color: var(--c-text-3);
      transition: all .15s; border-bottom: 2px solid transparent;
    }
    .speed-seg:hover { color: var(--c-text-1); }
    .speed-seg.active { color: var(--c-accent); border-bottom-color: var(--c-accent); }

    /* ── Aperçu ───────────────────────────── */
    .recap-row {
      display: flex; align-items: baseline; justify-content: space-between; gap: .75rem;
      padding: .5rem 0;
      border-bottom: 1px dashed var(--c-border);
    }
    .recap-row:last-child { border-bottom: none; }
    .recap-k { font-family: 'Outfit', sans-serif; font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; color: var(--c-text-3); }
    .recap-v { font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .92rem; color: var(--c-text-1); }
    .recap-total {
      margin-top: .25rem; padding: .85rem 1rem;
      border-radius: 10px; background: var(--c-accent-bg);
      display: flex; align-items: baseline; justify-content: space-between;
    }

    /* ── CTA ──────────────────────────────── */
    .setup-cta {
      position: sticky; bottom: 0;
      margin-top: .25rem;
      padding: .9rem 0 .25rem;
      background: linear-gradient(to top, var(--c-bg) 55%, transparent);
    }

    @keyframes fadeUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
    .fade-up { animation: fadeUp .4s cubic-bezier(.16,1,.3,1) both; }
  `],
  template: `
    <div class="setup-wrap">

      <!-- ── Carte titre ── -->
      <div class="text-center fade-up" style="animation-delay:.05s">
        @if (info.nomAr) {
          <p class="font-arabic c-text-1 mb-1" dir="rtl" style="font-size:2rem; font-weight:700; line-height:1.3">{{ info.nomAr }}</p>
        }
        <p class="font-display text-[10px] tracking-[.22em] uppercase c-text-3">{{ info.nom }}</p>
        <div class="green-rule max-w-[100px] mx-auto mt-2.5">
          <span class="c-accent" style="font-size:.45rem; opacity:.5">◆</span>
        </div>
        <div class="flex items-center justify-center gap-1.5 flex-wrap mt-2.5">
          @if (daajs.length === 1) {
            <span class="chip chip-gold">{{ daajs[0].nom }}</span>
          }
          @if (info.metrique) {
            <span class="chip">{{ info.metrique }}</span>
          }
          <span class="chip-muted chip">{{ detail.nb_vers }} abyāt</span>
        </div>
        @if (daajs.length === 1) {
          <p class="font-serif c-text-2 mt-1.5" style="font-size:.8rem">
            {{ daajs[0].kurel }}@if (ctx(daajs[0])) { · {{ ctx(daajs[0]) }} }
          </p>
        }
      </div>

      <!-- ── Sélecteur de daadj (si plusieurs) ── -->
      @if (daajs.length > 1) {
        <div class="panel fade-up" style="animation-delay:.08s">
          <p class="panel-label">Daadj</p>
          <app-daadj-selector [daajs]="daajs" [selected]="daadjId()" (select)="daadjId.set($event)" />
        </div>
      }

      <!-- ── 3 colonnes ── -->
      <div class="setup-grid">

        <!-- Colonne 1 : Sélection (mode de lecture) -->
        <section class="panel fade-up" style="animation-delay:.12s">
          <p class="panel-label">Sélection</p>

          <button class="mode-card" [class.active]="playbackMode() === 'boucle'" (click)="playbackMode.set('boucle')">
            <div class="mode-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-display text-xs tracking-wider uppercase c-text-1">Boucle</p>
              <p class="font-serif c-text-3 leading-snug" style="font-size:.74rem">Toute la plage · ×N passages</p>
            </div>
          </button>

          <button class="mode-card" [class.active]="playbackMode() === 'vers'" (click)="playbackMode.set('vers')">
            <div class="mode-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-display text-xs tracking-wider uppercase c-text-1">Vers</p>
              <p class="font-serif c-text-3" style="font-size:.74rem">Bayt entier · ×N fois</p>
            </div>
          </button>

          <button class="mode-card" [class.active]="playbackMode() === 'xaab'" (click)="playbackMode.set('xaab')">
            <div class="mode-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="14" x2="14" y2="14"/>
                <circle cx="19" cy="14" r="2" fill="currentColor" stroke="none" opacity=".6"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-display text-xs tracking-wider uppercase c-text-1">Xaab</p>
              <p class="font-serif c-text-3" style="font-size:.74rem">Ligne par ligne · ×N fois</p>
            </div>
          </button>
        </section>

        <!-- Colonne 2 : Paramètres (plage, répétitions, vitesse) -->
        <section class="panel fade-up" style="animation-delay:.16s">
          <p class="panel-label">Paramètres</p>

          <!-- Plage -->
          <div class="flex flex-col gap-2.5">
            <div class="flex items-center justify-between">
              <span class="field-label">Plage de vers</span>
              <span class="font-serif c-text-2" style="font-size:.78rem">{{ versCount() }} abyāt</span>
            </div>
            <div class="range-track">
              <div class="range-fill" [style.left.%]="rangeLeft()" [style.width.%]="rangeWidth()"></div>
            </div>
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <button class="range-stepper" (click)="decrement('start')" [disabled]="startVers() <= 1">−</button>
                <input class="range-input" type="number" inputmode="numeric" [min]="1" [max]="maxVers"
                       [value]="startVers()" (change)="setStart($event)" />
                <button class="range-stepper" (click)="increment('start')" [disabled]="startVers() >= endVers()">+</button>
              </div>
              <span class="font-serif c-text-3" style="font-size:.7rem; opacity:.5">→</span>
              <div class="flex items-center gap-1.5">
                <button class="range-stepper" (click)="decrement('end')" [disabled]="endVers() <= startVers()">−</button>
                <input class="range-input" type="number" inputmode="numeric" [min]="1" [max]="maxVers"
                       [value]="endVers()" (change)="setEnd($event)" />
                <button class="range-stepper" (click)="increment('end')" [disabled]="endVers() >= maxVers">+</button>
              </div>
            </div>
            <div class="flex gap-1.5">
              <button (click)="setRange(1, maxVers)" class="quick-pick"
                [style.background]="startVers()===1 && endVers()===maxVers ? 'var(--c-accent-bg)' : 'var(--c-muted)'"
                [style.color]="startVers()===1 && endVers()===maxVers ? 'var(--c-accent)' : 'var(--c-text-3)'">Tout</button>
              <button (click)="setRange(1, Math.min(10, maxVers))" class="quick-pick"
                [style.background]="startVers()===1 && endVers()===Math.min(10,maxVers) ? 'var(--c-accent-bg)' : 'var(--c-muted)'"
                [style.color]="startVers()===1 && endVers()===Math.min(10,maxVers) ? 'var(--c-accent)' : 'var(--c-text-3)'">1 – 10</button>
              <button (click)="setRange(1, Math.min(20, maxVers))" class="quick-pick"
                [style.background]="startVers()===1 && endVers()===Math.min(20,maxVers) ? 'var(--c-accent-bg)' : 'var(--c-muted)'"
                [style.color]="startVers()===1 && endVers()===Math.min(20,maxVers) ? 'var(--c-accent)' : 'var(--c-text-3)'">1 – 20</button>
            </div>
          </div>

          <!-- Répétitions -->
          <div class="flex flex-col gap-2.5">
            <span class="field-label">{{ playbackMode() === 'boucle' ? 'Passages' : 'Répétitions' }}</span>
            <div class="flex gap-2 justify-between">
              @for (n of repOptions; track n) {
                <button class="rep-circle" [class.active]="repetitions() === n" (click)="repetitions.set(n)">{{ n }}×</button>
              }
            </div>
          </div>

          <!-- Vitesse -->
          <div class="flex flex-col gap-2">
            <span class="field-label">Vitesse</span>
            <div class="flex" style="border-bottom: 1px solid var(--c-border)">
              @for (r of rateOptions; track r) {
                <button class="speed-seg" [class.active]="playbackRate() === r" (click)="playbackRate.set(r)">{{ r }}×</button>
              }
            </div>
          </div>
        </section>

        <!-- Colonne 3 : Aperçu -->
        <section class="panel fade-up" style="animation-delay:.2s">
          <p class="panel-label">Aperçu</p>
          <div class="flex flex-col">
            <div class="recap-row">
              <span class="recap-k">Mode</span>
              <span class="recap-v">{{ modeLabel() }}</span>
            </div>
            <div class="recap-row">
              <span class="recap-k">Vers</span>
              <span class="recap-v">{{ startVers() }} – {{ endVers() }}</span>
            </div>
            <div class="recap-row">
              <span class="recap-k">{{ playbackMode() === 'boucle' ? 'Passages' : 'Répét.' }}</span>
              <span class="recap-v">{{ repetitions() }}×</span>
            </div>
            <div class="recap-row">
              <span class="recap-k">Vitesse</span>
              <span class="recap-v">{{ playbackRate() }}×</span>
            </div>
          </div>
          <div class="recap-total">
            <span class="recap-k" style="color:var(--c-accent)">Total lectures</span>
            <span class="font-display c-accent" style="font-size:1.35rem; font-weight:700">≈ {{ totalPlays() }}</span>
          </div>
        </section>
      </div>

      <!-- ── CTA ── -->
      <div class="setup-cta">
        <button (click)="onStart()" class="btn-primary w-full" style="padding:1rem; font-size:.95rem">
          <svg width="15" height="15" viewBox="0 0 18 18" fill="currentColor" style="margin-left:1px"><path d="M4 2.5l12 6.5-12 6.5V2.5z"/></svg>
          Entrer en druss
        </button>
      </div>
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
  daadjId      = signal('');

  get daajs(): Daadj[] { return this.info.daajs ?? []; }
  ctx = daadjContexte;

  versCount = computed(() => this.endVers() - this.startVers() + 1);

  rangeLeft  = computed(() => ((this.startVers() - 1) / this.maxVers) * 100);
  rangeWidth = computed(() => (this.versCount() / this.maxVers) * 100);

  modeLabel = computed(() => ({
    boucle: 'Boucle', vers: 'Vers', xaab: 'Xaab'
  }[this.playbackMode()]));

  // Estimation du nombre de lectures audio (lignes jouées) pour la séance.
  totalPlays = computed(() =>
    this.versCount() * this.detail.xaab_per_vers * this.repetitions());

  get maxVers(): number { return this.detail.audio_vers ?? this.detail.nb_vers; }

  ngOnInit(): void {
    this.endVers.set(Math.min(10, this.maxVers));
    this.daadjId.set(this.daajs[0]?.id ?? '');
  }

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

  /** Saisie directe du début : borne [1..maxVers] et pousse la fin si besoin. */
  setStart(e: Event): void {
    const el = e.target as HTMLInputElement;
    const n = parseInt(el.value, 10);
    if (!isNaN(n)) {
      const s = Math.min(Math.max(n, 1), this.maxVers);
      this.startVers.set(s);
      if (this.endVers() < s) this.endVers.set(s);
    }
    el.value = String(this.startVers()); // reflète toujours la valeur bornée
  }

  /** Saisie directe de la fin : borne [1..maxVers] et tire le début si besoin. */
  setEnd(e: Event): void {
    const el = e.target as HTMLInputElement;
    const n = parseInt(el.value, 10);
    if (!isNaN(n)) {
      const en = Math.min(Math.max(n, 1), this.maxVers);
      this.endVers.set(en);
      if (this.startVers() > en) this.startVers.set(en);
    }
    el.value = String(this.endVers());
  }

  onStart(): void {
    this.started.emit({
      khassidaId: this.info.id, daadjId: this.daadjId(),
      startVers: this.startVers(), endVers: this.endVers(),
      repetitions: this.repetitions(), playbackMode: this.playbackMode(), playbackRate: this.playbackRate(),
    });
  }
}
