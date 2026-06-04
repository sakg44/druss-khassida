import { Component, Input, Output, EventEmitter, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KhassidaInfo, KhassidaDetail } from '../../../../core/models/khassida.model';
import { SessionConfig, REPETITION_OPTIONS, PLAYBACK_RATE_OPTIONS, PlaybackMode } from '../../../../core/models/druss-session.model';

@Component({
  selector: 'app-session-setup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-md mx-auto py-8 flex flex-col gap-8 anim-in" style="animation-delay:0.05s">

      <div class="text-center">
        @if (info.nomAr) {
          <p class="font-arabic text-3xl mb-2 c-text-1" dir="rtl" style="font-weight:700">{{ info.nomAr }}</p>
        }
        <p class="font-display text-xs uppercase mb-3 c-text-3" style="letter-spacing:0.22em">{{ info.nom }}</p>
        <div class="green-rule max-w-[160px] mx-auto">
          <span class="c-accent" style="font-size:0.5rem; opacity:0.6">◆</span>
        </div>
        <p class="font-serif text-sm mt-3 c-text-3" style="font-size:0.9rem">
          {{ detail.nb_vers }} abyāt
          @if (detail.audio_vers && detail.audio_vers !== detail.nb_vers) {
            <span> · {{ detail.audio_vers }} segments audio</span>
          }
        </p>
      </div>

      <div class="setup-section">
        <p class="font-display text-[10px] tracking-[0.2em] uppercase mb-4 c-text-3">Plage de vers</p>
        <div class="grid grid-cols-2 gap-6">
          <div class="flex flex-col gap-2">
            <span class="font-serif text-xs c-text-3" style="font-size:0.85rem">Début</span>
            <div class="flex items-center gap-2">
              <button class="counter-btn" (click)="decrement('start')" [disabled]="startVers() <= 1">−</button>
              <span class="flex-1 text-center font-display text-2xl c-text-1">{{ startVers() }}</span>
              <button class="counter-btn" (click)="increment('start')" [disabled]="startVers() >= endVers()">+</button>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <span class="font-serif text-xs c-text-3" style="font-size:0.85rem">Fin</span>
            <div class="flex items-center gap-2">
              <button class="counter-btn" (click)="decrement('end')" [disabled]="endVers() <= startVers()">−</button>
              <span class="flex-1 text-center font-display text-2xl c-text-1">{{ endVers() }}</span>
              <button class="counter-btn" (click)="increment('end')" [disabled]="endVers() >= maxVers">+</button>
            </div>
          </div>
        </div>
        <p class="font-serif text-xs text-center mt-3 c-text-3" style="font-size:0.8rem">
          {{ versCount() }} vers sélectionné{{ versCount() > 1 ? 's' : '' }}
        </p>
      </div>

      <div class="setup-section">
        <p class="font-display text-[10px] tracking-[0.2em] uppercase mb-4 c-text-3">Mode de lecture</p>
        <div class="flex flex-col gap-2">
          <button class="mode-btn" [class.active]="playbackMode() === 'boucle'" (click)="playbackMode.set('boucle')">
            <p class="font-display text-xs tracking-wider uppercase mb-0.5">Boucle</p>
            <p class="font-serif text-xs c-text-3" style="font-size:0.82rem">Toute la plage en séquence · recommence X fois</p>
          </button>
          <div class="grid grid-cols-2 gap-2">
            <button class="mode-btn" [class.active]="playbackMode() === 'vers'" (click)="playbackMode.set('vers')">
              <p class="font-display text-xs tracking-wider uppercase mb-0.5">Vers entier</p>
              <p class="font-serif text-xs c-text-3" style="font-size:0.82rem">Bayt × N</p>
            </button>
            <button class="mode-btn" [class.active]="playbackMode() === 'xaab'" (click)="playbackMode.set('xaab')">
              <p class="font-display text-xs tracking-wider uppercase mb-0.5">Xaab / xaab</p>
              <p class="font-serif text-xs c-text-3" style="font-size:0.82rem">Chaque ligne × N</p>
            </button>
          </div>
        </div>
      </div>

      <div class="setup-section">
        <p class="font-display text-[10px] tracking-[0.2em] uppercase mb-4 c-text-3">
          {{ playbackMode() === 'boucle' ? 'Passages' : 'Répétitions par unité' }}
        </p>
        <div class="flex gap-2">
          @for (n of repOptions; track n) {
            <button class="rep-btn" [class.active]="repetitions() === n" (click)="repetitions.set(n)">{{ n }}×</button>
          }
        </div>
        @if (playbackMode() === 'boucle') {
          <p class="font-serif text-xs text-center mt-3 c-text-3" style="font-size:0.8rem">
            {{ versCount() }} vers × {{ repetitions() }} passages = {{ versCount() * repetitions() }} segments
          </p>
        }
      </div>

      <div class="setup-section">
        <p class="font-display text-[10px] tracking-[0.2em] uppercase mb-4 c-text-3">Vitesse</p>
        <div class="flex gap-2">
          @for (r of rateOptions; track r) {
            <button class="rep-btn" [class.active]="playbackRate() === r" (click)="playbackRate.set(r)">{{ r }}×</button>
          }
        </div>
      </div>

      <button (click)="onStart()"
              class="w-full py-4 font-display text-sm tracking-[0.2em] uppercase transition-all duration-200 hover:opacity-90 active:scale-95"
              style="background:linear-gradient(135deg, var(--c-accent-2), var(--c-accent)); color:#fff; border-radius:3px">
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
  startVers    = signal(1);
  endVers      = signal(10);
  repetitions  = signal(3);
  playbackMode = signal<PlaybackMode>('boucle');
  playbackRate = signal(1);
  versCount    = computed(() => this.endVers() - this.startVers() + 1);

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
  onStart(): void {
    this.started.emit({
      khassidaId: this.info.id, startVers: this.startVers(), endVers: this.endVers(),
      repetitions: this.repetitions(), playbackMode: this.playbackMode(), playbackRate: this.playbackRate(),
    });
  }
}
