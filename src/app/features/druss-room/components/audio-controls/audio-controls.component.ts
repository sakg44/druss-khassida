import { Component, Input, Output, EventEmitter } from '@angular/core';

import { DrussSession, PLAYBACK_RATE_OPTIONS } from '../../../../core/models/druss-session.model';
import { Daadj, daadjContexte } from '../../../../core/models/khassida.model';

@Component({
  selector: 'app-audio-controls',
  standalone: true,
  imports: [],
  template: `
    <div class="flex flex-col gap-5">
      @if (daadj || metrique) {
        <div class="text-center flex flex-col items-center gap-1.5">
          <div class="flex items-center justify-center gap-1.5 flex-wrap">
            @if (daadj) {
              <span class="chip chip-gold" style="padding:.2rem .55rem; font-size:.62rem">{{ daadj.nom }}</span>
            }
            @if (metrique) {
              <span class="chip" style="padding:.2rem .55rem; font-size:.62rem">{{ metrique }}</span>
            }
          </div>
          @if (daadj) {
            <p class="font-serif c-text-3" style="font-size:.74rem">
              {{ daadj.kurel }}{{ ctx(daadj) ? ' · ' + ctx(daadj) : '' }}
            </p>
          }
        </div>
      }

      <div class="flex items-center justify-center gap-5">
        <button class="btn-nav w-11 h-11" [disabled]="!canPrev" (click)="previous.emit()">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M2 2h1.5v10H2V2zm9.5 1.4L5.8 7l5.7 3.6V3.4z"/>
          </svg>
        </button>
        <button class="btn-play w-16 h-16" [class.playing]="session.isPlaying"
                [disabled]="session.isComplete" (click)="playPause.emit()">
          @if (session.isPlaying) {
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <rect x="3" y="2" width="4" height="14" rx="1"/>
              <rect x="11" y="2" width="4" height="14" rx="1"/>
            </svg>
          } @else {
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" style="margin-left:2px">
              <path d="M4 2.5l12 6.5-12 6.5V2.5z"/>
            </svg>
          }
        </button>
        <button class="btn-nav w-11 h-11" [disabled]="!canNext" (click)="next.emit()">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M10.5 2H12v10h-1.5V2zM2.5 3.4l5.7 3.6-5.7 3.6V3.4z"/>
          </svg>
        </button>
      </div>

      <div class="flex items-center justify-center gap-3">
        <div class="flex items-center gap-1">
          @for (r of rateOptions; track r) {
            <button class="speed-chip" [class.active]="session.config.playbackRate === r"
                    (click)="speedChange.emit(r)">{{ r }}×</button>
          }
        </div>
        <button (click)="muteToggle.emit()"
                class="btn-nav w-8 h-8"
                [style.opacity]="isMuted ? '0.45' : '1'"
                [title]="isMuted ? 'Réactiver' : 'Muet'">
          @if (isMuted) {
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
  `,
})
export class AudioControlsComponent {
  @Input() session!: DrussSession;
  @Input() isMuted = false;
  @Input() daadj: Daadj | null = null;
  @Input() metrique = '';

  ctx = daadjContexte;
  @Output() playPause   = new EventEmitter<void>();
  @Output() previous    = new EventEmitter<void>();
  @Output() next        = new EventEmitter<void>();
  @Output() speedChange = new EventEmitter<number>();
  @Output() muteToggle  = new EventEmitter<void>();

  rateOptions = PLAYBACK_RATE_OPTIONS;
  get canPrev() { return !this.session.isComplete && this.session.currentVers > this.session.config.startVers; }
  get canNext() { return !this.session.isComplete && this.session.currentVers < this.session.config.endVers; }
}
