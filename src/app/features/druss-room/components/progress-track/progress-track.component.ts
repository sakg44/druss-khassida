import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrussSession } from '../../../../core/models/druss-session.model';

@Component({
  selector: 'app-progress-track',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <span class="font-display text-[10px] tracking-wider w-6 text-right shrink-0 c-text-3">
          {{ session.config.startVers }}
        </span>
        <div class="flex-1 progress-track">
          <div class="progress-fill" [style.width.%]="progressPercent"></div>
        </div>
        <span class="font-display text-[10px] tracking-wider w-6 shrink-0 c-text-3">
          {{ session.config.endVers }}
        </span>
      </div>

      <div class="flex flex-col items-center gap-1.5">
        <div class="flex items-center justify-center gap-2">
          @for (dot of dots; track $index) {
            <div class="rep-dot" [class.done]="dot"></div>
          }
        </div>
        @if (session.config.playbackMode === 'boucle') {
          <span class="font-display text-[10px] tracking-widest uppercase c-text-3">
            passage {{ session.currentLoopPass }} / {{ session.config.repetitions }}
          </span>
        }
      </div>
    </div>
  `,
})
export class ProgressTrackComponent {
  @Input() session!: DrussSession;
  @Input() totalVers = 0;

  get progressPercent(): number {
    const { startVers, endVers } = this.session.config;
    const range = endVers - startVers;
    if (range === 0) return 100;
    return ((this.session.currentVers - startVers) / range) * 100;
  }

  get dots(): boolean[] {
    const total = this.session.config.repetitions;
    const current = this.session.config.playbackMode === 'boucle'
      ? this.session.currentLoopPass
      : this.session.currentRepetition;
    return Array.from({ length: total }, (_, i) => i < current);
  }
}
