import { Component, inject, OnInit, signal } from '@angular/core';

import { RouterModule } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { ThemeService } from '../../core/services/theme.service';
import { KhassidaInfo } from '../../core/models/khassida.model';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [RouterModule],
  styles: [`
    .hero-glow {
      position: absolute; top: -10%; left: 50%; transform: translateX(-50%);
      width: 480px; height: 480px; border-radius: 50%;
      background: radial-gradient(circle, var(--c-accent-bg) 0%, transparent 70%);
      opacity: .6; pointer-events: none; z-index: 0;
    }
    .card-art {
      position: relative;
      background:
        linear-gradient(135deg, var(--c-accent-bg) 0%, transparent 55%),
        var(--c-surface-2);
      overflow: hidden;
    }
    .card-art::after {
      content: ''; position: absolute; inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 2 L38 20 L20 38 L2 20 Z' fill='none' stroke='%231b6b50' stroke-width='0.5' opacity='0.10'/%3E%3C/svg%3E");
      background-size: 40px 40px;
    }
    .arrow-cta {
      transition: transform .3s cubic-bezier(.16,1,.3,1);
    }
    .book-card:hover .arrow-cta { transform: translateX(4px); }
  `],
  template: `
    <div class="relative min-h-screen px-5 py-10 sm:py-14 flex flex-col items-center overflow-hidden">
      <div class="hero-glow"></div>

      <!-- Theme toggle -->
      <button class="theme-btn fixed top-4 right-4 z-20" (click)="themeService.toggle()"
              [title]="themeService.isDark() ? 'Mode clair' : 'Mode sombre'">
        @if (themeService.isDark()) {
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/>
          </svg>
        } @else {
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        }
      </button>

      <!-- Hero -->
      <header class="relative z-10 text-center mb-12 sm:mb-16 anim-in max-w-xl">
        <span class="chip chip-gold mb-5">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0l1.5 4.5L12 6 7.5 7.5 6 12 4.5 7.5 0 6l4.5-1.5z"/></svg>
          Kurel · Mouridiyya
        </span>

        <p class="font-arabic text-xl mb-3 c-text-2" dir="rtl" style="opacity:.8">
          بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </p>

        <h1 class="font-display c-text-1 mb-3"
            style="font-size:clamp(2.2rem,7vw,3.4rem); font-weight:800; line-height:1.05">
          Druss Khassida
        </h1>

        <p class="font-serif c-text-2 mx-auto" style="font-size:1.02rem; max-width:30rem; line-height:1.55">
          Le salon d'apprentissage des Khassidés de
          <span class="c-text-1" style="font-weight:600">Cheikh Ahmadou Bamba Mbacké</span>.
          Écoute, suis le texte, mémorise.
        </p>
      </header>

      @if (khassidas().length === 0) {
        <div class="spinner anim-in mt-10" style="animation-delay:.1s"></div>
      } @else {
        <!-- Section label -->
        <div class="relative z-10 w-full max-w-4xl mb-5 flex items-center justify-between anim-in" style="animation-delay:.1s">
          <h2 class="font-display c-text-1" style="font-size:1.05rem; font-weight:700">Khassidés</h2>
          <span class="font-display c-text-3" style="font-size:.8rem; font-weight:500">{{ khassidas().length }} disponible{{ khassidas().length > 1 ? 's' : '' }}</span>
        </div>

        <div class="relative z-10 w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (k of khassidas(); track k.id; let i = $index) {
            <a [routerLink]="k.disponible ? ['/druss', k.id] : null"
               class="book-card anim-in"
               [class.unavailable]="!k.disponible"
               [style.animation-delay]="(i * 0.07 + 0.18) + 's'">

              <!-- Visual top : Arabic name on patterned art -->
              <div class="card-art flex items-center justify-center px-5" style="height:140px">
                @if (k.nomAr) {
                  <p class="font-arabic c-text-1 relative z-10" dir="rtl"
                     style="font-size:2.6rem; font-weight:700; line-height:1.1">{{ k.nomAr }}</p>
                }
                <!-- badge -->
                <div class="absolute top-3 right-3 z-10">
                  @if (k.disponible) {
                    <span class="chip" style="padding:.2rem .5rem; font-size:.6rem">disponible</span>
                  } @else {
                    <span class="chip-muted chip" style="padding:.2rem .5rem; font-size:.6rem">bientôt</span>
                  }
                </div>
              </div>

              <!-- Info -->
              <div class="flex items-center justify-between gap-3 px-5 py-4"
                   style="border-top:1px solid var(--c-border)">
                <div class="min-w-0">
                  <p class="font-display c-text-1 truncate" style="font-size:1.05rem; font-weight:700">{{ k.nom }}</p>
                  <p class="font-serif c-text-3 mt-0.5" style="font-size:.82rem">{{ k.nb_vers }} abyāt · {{ k.metrique }}</p>
                </div>
                @if (k.disponible) {
                  <div class="arrow-cta shrink-0 flex items-center justify-center"
                       style="width:34px; height:34px; border-radius:10px; background:var(--c-accent-bg); color:var(--c-accent)">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 8h10M9 4l4 4-4 4"/>
                    </svg>
                  </div>
                }
              </div>
            </a>
          }
        </div>
      }

      <!-- Footer -->
      <footer class="relative z-10 mt-16 text-center anim-in" style="animation-delay:.4s">
        <div class="green-rule max-w-[120px] mx-auto mb-3">
          <span class="c-gold" style="font-size:.6rem">◆</span>
        </div>
        <p class="font-serif c-text-3" style="font-size:.78rem">
          Khamul · Serviteur du Prophète ﷺ
        </p>
      </footer>
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
