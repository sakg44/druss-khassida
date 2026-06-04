import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { ThemeService } from '../../core/services/theme.service';
import { KhassidaInfo } from '../../core/models/khassida.model';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen px-4 py-14 flex flex-col items-center">

      <!-- Theme toggle top-right -->
      <button class="theme-btn fixed top-4 right-4 z-20" (click)="themeService.toggle()" [title]="themeService.isDark() ? 'Mode clair' : 'Mode sombre'">
        @if (themeService.isDark()) {
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/>
          </svg>
        } @else {
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        }
      </button>

      <!-- Header -->
      <header class="text-center mb-16 anim-in" style="animation-delay:0s">
        <p class="font-arabic text-lg tracking-widest mb-4 c-text-3" dir="rtl" style="opacity:0.75">
          بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </p>
        <h1 class="font-display text-3xl md:text-4xl uppercase mb-1 c-text-1" style="letter-spacing:0.2em">
          Druss Khassida
        </h1>
        <div class="green-rule my-4 max-w-xs mx-auto">
          <span class="font-display text-xs c-accent" style="opacity:0.7">✦</span>
        </div>
        <p class="font-serif italic c-text-3" style="font-size:1.05rem">
          Salon d'apprentissage · Cheikh Ahmadou Bamba Mbacké
        </p>
      </header>

      @if (khassidas().length === 0) {
        <div class="spinner anim-in" style="animation-delay:0.1s"></div>
      } @else {
        <div class="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (k of khassidas(); track k.id; let i = $index) {
            <a
              [routerLink]="k.disponible ? ['/druss', k.id] : null"
              class="book-card anim-in"
              [class.unavailable]="!k.disponible"
              [style.animation-delay]="(i * 0.08 + 0.15) + 's'"
            >
              <div class="px-5 pt-5 pb-3">
                <div class="green-rule">
                  <span class="c-accent" style="font-size:0.55rem; opacity:0.6">◆</span>
                </div>
              </div>

              <div class="flex-1 flex flex-col items-center justify-center px-5 py-4 gap-3 text-center">
                @if (k.nomAr) {
                  <p class="font-arabic text-4xl leading-tight c-text-1" dir="rtl" style="font-weight:700">{{ k.nomAr }}</p>
                }
                <p class="font-display text-xs uppercase c-text-3" style="letter-spacing:0.22em">{{ k.nom }}</p>
                <span class="c-border" style="font-size:0.5rem">◆</span>
                <p class="font-serif c-text-2" style="font-size:0.9rem">{{ k.nb_vers }} abyāt</p>
              </div>

              <div class="px-5 pb-5 pt-3">
                <div class="green-rule">
                  <span class="c-accent" style="font-size:0.55rem; opacity:0.6">◆</span>
                </div>
              </div>

              <div class="absolute top-3 right-3">
                @if (k.disponible) {
                  <span class="font-display text-[9px] tracking-widest uppercase px-2 py-0.5"
                        style="background:var(--c-accent-bg); color:var(--c-accent); border:1px solid var(--c-accent); border-radius:2px; opacity:0.9">
                    disponible
                  </span>
                } @else {
                  <span class="font-display text-[9px] tracking-widest uppercase px-2 py-0.5"
                        style="background:var(--c-muted); color:var(--c-text-3); border:1px solid var(--c-border); border-radius:2px">
                    bientôt
                  </span>
                }
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class CatalogComponent implements OnInit {
  private catalogService = inject(CatalogService);
  themeService = inject(ThemeService);
  khassidas = signal<KhassidaInfo[]>([]);

  ngOnInit(): void {
    this.catalogService.getKhassidas().subscribe(list => this.khassidas.set(list));
  }
}
