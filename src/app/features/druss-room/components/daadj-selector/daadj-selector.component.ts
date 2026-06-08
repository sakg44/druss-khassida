import { Component, Input, Output, EventEmitter } from '@angular/core';

import { Daadj, daadjContexte } from '../../../../core/models/khassida.model';

/**
 * Sélecteur de daadj (style de sonorisation). Affiche une pastille par
 * style. Le parent décide de le masquer quand un seul daadj existe.
 */
@Component({
  selector: 'app-daadj-selector',
  standalone: true,
  imports: [],
  styles: [`
    .daadj-pill {
      display: flex; flex-direction: column; align-items: flex-start; gap: .1rem;
      padding: .5rem .85rem;
      border: 1px solid var(--c-border);
      border-radius: 10px;
      background: var(--c-surface);
      cursor: pointer;
      font-family: 'Outfit', sans-serif;
      color: var(--c-text-2);
      transition: all .15s;
      text-align: left;
    }
    .daadj-pill:hover { border-color: var(--c-accent); }
    .daadj-pill.active {
      background: var(--c-accent-bg);
      border-color: var(--c-accent);
      color: var(--c-accent);
    }
    .daadj-pill .d-nom { font-size: .74rem; font-weight: 600; white-space: nowrap; }
    .daadj-pill .d-sub { font-size: .62rem; font-weight: 500; opacity: .7; white-space: nowrap; }
  `],
  template: `
    <div class="flex gap-2 flex-wrap">
      @for (d of daajs; track d.id) {
        <button class="daadj-pill" [class.active]="d.id === selected" (click)="select.emit(d.id)">
          <span class="d-nom">{{ d.nom }}</span>
          <span class="d-sub">{{ d.kurel }}{{ ctx(d) ? ' · ' + ctx(d) : '' }}</span>
        </button>
      }
    </div>
  `,
})
export class DaadjSelectorComponent {
  @Input() daajs: Daadj[] = [];
  @Input() selected = '';
  @Output() select = new EventEmitter<string>();

  ctx = daadjContexte;
}
