import { Component, inject, OnInit, signal, computed } from '@angular/core';

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
    /* ── Carte : esthétique « plaque enluminée » ── */
    .book-card {
      border-radius: 16px;
      overflow: hidden;
      transition: transform .4s cubic-bezier(.16,1,.3,1), box-shadow .4s, border-color .4s;
    }
    .book-card:hover {
      transform: translateY(-5px);
      border-color: color-mix(in srgb, var(--c-accent) 55%, var(--c-border));
    }

    .card-art {
      position: relative;
      display: flex; align-items: center; justify-content: center;
      padding: 1.25rem;
      background:
        radial-gradient(125% 95% at 50% 0%, var(--c-accent-bg) 0%, transparent 58%),
        linear-gradient(165deg, var(--c-surface-2), var(--c-surface));
      overflow: hidden;
    }
    /* treillis géométrique doré (khatam à 8 branches) */
    .card-art::after {
      content: ''; position: absolute; inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg width='48' height='48' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23b08d3c' stroke-width='0.7'%3E%3Cpath d='M24 3 L45 24 L24 45 L3 24 Z'/%3E%3Crect x='9' y='9' width='30' height='30'/%3E%3C/g%3E%3C/svg%3E");
      background-size: 48px 48px;
      opacity: .07;
      pointer-events: none;
    }
    /* halo doux derrière le nom */
    .art-glow {
      position: absolute; z-index: 1;
      width: 62%; height: 60%; border-radius: 50%;
      background: radial-gradient(circle, var(--c-accent-ring) 0%, transparent 70%);
      filter: blur(6px); opacity: .75;
      transition: transform .5s cubic-bezier(.16,1,.3,1), opacity .5s;
    }
    .book-card:hover .art-glow { transform: scale(1.22); opacity: 1; }
    /* filet d'or sous le nom arabe */
    .art-rule {
      position: absolute; bottom: .8rem; left: 50%; transform: translateX(-50%);
      z-index: 2; display: flex; align-items: center; gap: .4rem;
      color: var(--c-gold); opacity: .8;
    }
    .art-rule::before, .art-rule::after {
      content: ''; width: 24px; height: 1px;
    }
    .art-rule::before { background: linear-gradient(90deg, transparent, var(--c-gold)); }
    .art-rule::after  { background: linear-gradient(90deg, var(--c-gold), transparent); }
    /* chips dépolies sur l'illustration */
    .card-art .chip { backdrop-filter: blur(6px); box-shadow: var(--shadow-sm); }

    /* zone info + nœud doré sur le séparateur */
    .card-info {
      position: relative;
      display: flex; align-items: center; gap: .75rem;
      padding: .95rem 1.15rem 1.05rem;
      border-top: 1px solid var(--c-border);
    }
    .card-info::before {
      content: ''; position: absolute; top: -4px; left: 50%;
      transform: translateX(-50%) rotate(45deg);
      width: 7px; height: 7px; border-radius: 1px;
      background: var(--c-gold);
      box-shadow: 0 0 0 4px var(--c-surface);
    }
    .card-go {
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--c-accent-bg); color: var(--c-accent);
      transition: background .3s, color .3s, transform .3s, box-shadow .3s;
    }
    .book-card:hover .card-go {
      background: var(--c-accent); color: #fff;
      transform: translateX(3px); box-shadow: var(--shadow-accent);
    }

    /* ── Filtre par métrique ──────────────── */
    .filter-bar {
      display: flex; flex-wrap: wrap; gap: .5rem;
      justify-content: center;
    }
    .filter-chip {
      display: inline-flex; align-items: center; gap: .5rem;
      padding: .42rem .9rem; border-radius: 999px;
      border: 1px solid var(--c-border); background: var(--c-surface);
      font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .78rem;
      color: var(--c-text-2); cursor: pointer;
      transition: border-color .18s, color .18s, background .18s, transform .12s;
      white-space: nowrap;
    }
    .filter-chip:hover { border-color: var(--c-accent); color: var(--c-accent); transform: translateY(-1px); }
    .filter-chip.active { background: var(--c-accent); border-color: var(--c-accent); color: #fff; }
    .filter-chip .cnt {
      font-size: .64rem; font-weight: 700; line-height: 1;
      padding: .18rem .4rem; border-radius: 999px;
      background: var(--c-muted); color: var(--c-text-3);
    }
    .filter-chip:hover .cnt { background: var(--c-accent-bg); color: var(--c-accent); }
    .filter-chip.active .cnt { background: rgba(255,255,255,.22); color: #fff; }

    /* ── Sélecteurs de vue / taille ───────── */
    .seg-group {
      display: inline-flex; border: 1px solid var(--c-border);
      border-radius: 8px; overflow: hidden; background: var(--c-surface);
    }
    .seg-btn {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 30px; border: none; background: transparent;
      color: var(--c-text-3); cursor: pointer; transition: background .15s, color .15s;
    }
    .seg-btn + .seg-btn { border-left: 1px solid var(--c-border); }
    .seg-btn:hover { color: var(--c-accent); }
    .seg-btn.active { background: var(--c-accent-bg); color: var(--c-accent); }

    /* ── Grille + tailles ─────────────────── */
    .cards-grid { display: grid; gap: 1.25rem; width: 100%; }
    .cards-grid.size-compact     { grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)); gap: 1rem; }
    .cards-grid.size-comfortable { grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
    .cards-grid.size-large       { grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); }
    .cards-grid .card-art { height: 140px; }
    .cards-grid.size-compact .card-art { height: 104px; }
    .cards-grid.size-large   .card-art { height: 188px; }
    .card-ar { font-weight: 700; line-height: 1.1; font-size: 2.6rem; }
    .cards-grid.size-compact .card-ar { font-size: 2rem; }
    .cards-grid.size-large   .card-ar { font-size: 3.1rem; }

    /* ── Vue liste ────────────────────────── */
    .list-stack { display: flex; flex-direction: column; gap: .6rem; width: 100%; }
    .list-row {
      display: flex; align-items: center; gap: .9rem;
      padding: .8rem 1.05rem;
      border: 1px solid var(--c-border); border-radius: 12px;
      background: var(--c-surface);
      transition: border-color .18s, transform .12s;
    }
    .list-row:hover {
      border-color: color-mix(in srgb, var(--c-accent) 45%, transparent);
      transform: translateX(3px);
    }
    .list-row:hover .arrow-cta { transform: translateX(4px); }
    .unavailable { opacity: .5; pointer-events: none; }
  `],
  template: `
    <div class="relative min-h-screen px-5 py-10 sm:py-14 flex flex-col items-center overflow-hidden">
      <div class="hero-glow"></div>

      <!-- Theme toggle -->
      <button class="theme-btn fixed z-20" (click)="themeService.toggle()"
              style="top: max(1rem, env(safe-area-inset-top)); right: max(1rem, env(safe-area-inset-right))"
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
          Kurel 
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
        <!-- Barre d'outils : titre, compteur, sélecteurs de vue/taille -->
        <div class="relative z-10 w-full max-w-4xl mb-4 flex items-center justify-between gap-3 anim-in" style="animation-delay:.1s">
          <div class="flex items-baseline gap-2.5 min-w-0">
            <h2 class="font-display c-text-1" style="font-size:1.05rem; font-weight:700">khassaides</h2>
            <span class="font-display c-text-3" style="font-size:.8rem; font-weight:500">{{ filtered().length }} titre{{ filtered().length > 1 ? 's' : '' }}</span>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <!-- Taille (vue grille seulement) -->
            @if (viewMode() === 'grid') {
              <div class="seg-group">
                <button class="seg-btn" [class.active]="cardSize() === 'compact'" (click)="setSize('compact')" title="Compact">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>
                </button>
                <button class="seg-btn" [class.active]="cardSize() === 'comfortable'" (click)="setSize('comfortable')" title="Confort">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="5" height="12" rx="1"/><rect x="9" y="2" width="5" height="12" rx="1"/></svg>
                </button>
                <button class="seg-btn" [class.active]="cardSize() === 'large'" (click)="setSize('large')" title="Large">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="1.5"/></svg>
                </button>
              </div>
            }

            <!-- Vue grille / liste -->
            <div class="seg-group">
              <button class="seg-btn" [class.active]="viewMode() === 'grid'" (click)="setView('grid')" title="Grille">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
              </button>
              <button class="seg-btn" [class.active]="viewMode() === 'list'" (click)="setView('list')" title="Liste">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="3" rx="1"/><rect x="1" y="7" width="14" height="3" rx="1"/><rect x="1" y="12" width="14" height="3" rx="1"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Filtre par métrique -->
        @if (metrics().length > 1) {
          <div class="relative z-10 w-full max-w-4xl mb-6 filter-bar anim-in" style="animation-delay:.14s">
            <button class="filter-chip" [class.active]="activeMetric() === ''" (click)="activeMetric.set('')">
              Tout <span class="cnt">{{ khassidas().length }}</span>
            </button>
            @for (m of metrics(); track m.metrique) {
              <button class="filter-chip" [class.active]="activeMetric() === m.metrique" (click)="activeMetric.set(m.metrique)">
                {{ m.metrique }} <span class="cnt">{{ m.count }}</span>
              </button>
            }
          </div>
        }

        <!-- ── Vue grille ── -->
        @if (viewMode() === 'grid') {
          <div class="relative z-10 w-full max-w-4xl cards-grid"
               [class.size-compact]="cardSize() === 'compact'"
               [class.size-comfortable]="cardSize() === 'comfortable'"
               [class.size-large]="cardSize() === 'large'">
            @for (k of filtered(); track k.id; let i = $index) {
              <a [routerLink]="k.disponible ? ['/druss', k.id] : null"
                 class="book-card anim-in"
                 [class.unavailable]="!k.disponible"
                 [style.animation-delay]="(i * 0.07 + 0.18) + 's'">

                <!-- Illustration : nom arabe enluminé -->
                <div class="card-art">
                  <div class="art-glow"></div>
                  @if (k.nomAr) {
                    <p class="font-arabic card-ar c-text-1" dir="rtl" style="position:relative; z-index:2">{{ k.nomAr }}</p>
                  }
                  <span class="art-rule">
                    <svg width="6" height="6" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0l1.1 2.9L8 4 5.1 5.1 4 8 2.9 5.1 0 4l2.9-1.1z"/></svg>
                  </span>
                  @if (k.daajs.length) {
                    <div class="absolute top-3 left-3 z-10">
                      <span class="chip chip-gold" style="padding:.2rem .5rem; font-size:.6rem">
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor"><path d="M5 1v7.1a2.2 2.2 0 1 0 1.4 2V3.4l3.6-.9V1L5 1z"/></svg>
                        {{ daadjLabel(k) }}
                      </span>
                    </div>
                  }
                  @if (k.metrique) {
                    <div class="absolute top-3 right-3 z-10">
                      <span class="chip" style="padding:.2rem .5rem; font-size:.6rem">{{ k.metrique }}</span>
                    </div>
                  }
                </div>

                <!-- Info -->
                <div class="card-info">
                  <div class="min-w-0 flex-1">
                    <p class="font-display c-text-1 truncate" style="font-size:1.05rem; font-weight:700">{{ k.nom }}</p>
                    <p class="font-serif c-text-3 mt-0.5 truncate" style="font-size:.8rem">
                      {{ k.nb_vers }} abyāt@if (kurelLabel(k); as kurel) { · {{ kurel }} }
                    </p>
                  </div>
                  @if (k.disponible) {
                    <div class="card-go">
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

        <!-- ── Vue liste ── -->
        @if (viewMode() === 'list') {
          <div class="relative z-10 w-full max-w-4xl list-stack">
            @for (k of filtered(); track k.id; let i = $index) {
              <a [routerLink]="k.disponible ? ['/druss', k.id] : null"
                 class="list-row anim-in"
                 [class.unavailable]="!k.disponible"
                 [style.animation-delay]="(i * 0.05 + 0.18) + 's'">
                @if (k.nomAr) {
                  <span class="font-arabic c-text-1 shrink-0" dir="rtl" style="font-size:1.3rem; font-weight:700">{{ k.nomAr }}</span>
                }
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="font-display c-text-1 truncate" style="font-size:.98rem; font-weight:700">{{ k.nom }}</span>
                  <span class="font-serif c-text-3 truncate" style="font-size:.74rem">
                    {{ k.nb_vers }} abyāt@if (kurelLabel(k); as kurel) { · {{ kurel }} }
                  </span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  @if (k.daajs.length) {
                    <span class="chip chip-gold" style="padding:.2rem .5rem; font-size:.6rem">{{ daadjLabel(k) }}</span>
                  }
                  @if (k.metrique) {
                    <span class="chip" style="padding:.2rem .5rem; font-size:.6rem">{{ k.metrique }}</span>
                  }
                </div>
                @if (k.disponible) {
                  <svg class="arrow-cta shrink-0 c-accent" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                }
              </a>
            }
          </div>
        }
      }

      <!-- Footer -->
      <footer class="relative z-10 mt-16 text-center anim-in" style="animation-delay:.4s">
        <div class="green-rule max-w-[120px] mx-auto mb-3">
          <span class="c-gold" style="font-size:.6rem">◆</span>
        </div>
        <p class="font-serif c-text-3" style="font-size:.78rem">
          Serviteur du Prophète ﷺ
        </p>
      </footer>
    </div>
  `,
})
export class CatalogComponent implements OnInit {
  private catalogService = inject(CatalogService);
  themeService = inject(ThemeService);
  khassidas = signal<KhassidaInfo[]>([]);
  activeMetric = signal<string>('');
  viewMode = signal<'grid' | 'list'>('grid');
  cardSize = signal<'compact' | 'comfortable' | 'large'>('comfortable');

  /** Métriques distinctes (non vides) avec leur nombre de titres. */
  metrics = computed(() => {
    const map = new Map<string, number>();
    for (const k of this.khassidas()) {
      if (!k.metrique) continue;
      map.set(k.metrique, (map.get(k.metrique) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([metrique, count]) => ({ metrique, count }))
      .sort((a, b) => a.metrique.localeCompare(b.metrique));
  });

  /** Titres affichés selon le filtre métrique actif. */
  filtered = computed(() => {
    const m = this.activeMetric();
    return m ? this.khassidas().filter(k => k.metrique === m) : this.khassidas();
  });

  ngOnInit(): void {
    const v = localStorage.getItem('catalog.view');
    if (v === 'grid' || v === 'list') this.viewMode.set(v);
    const s = localStorage.getItem('catalog.size');
    if (s === 'compact' || s === 'comfortable' || s === 'large') this.cardSize.set(s);

    this.catalogService.getKhassidas().subscribe(list => this.khassidas.set(list));
  }

  setView(v: 'grid' | 'list'): void {
    this.viewMode.set(v);
    localStorage.setItem('catalog.view', v);
  }

  setSize(s: 'compact' | 'comfortable' | 'large'): void {
    this.cardSize.set(s);
    localStorage.setItem('catalog.size', s);
  }

  /** Libellé du/des daadj : nom unique ou « N daadj » si plusieurs. */
  daadjLabel(k: KhassidaInfo): string {
    const d = k.daajs ?? [];
    if (d.length === 0) return '';
    return d.length === 1 ? d[0].nom : `${d.length} daadj`;
  }

  /** Kurel : nom du groupe si un seul daadj, sinon vide (le sélecteur les liste). */
  kurelLabel(k: KhassidaInfo): string {
    const d = k.daajs ?? [];
    return d.length === 1 ? d[0].kurel : '';
  }
}
