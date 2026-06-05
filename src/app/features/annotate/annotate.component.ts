import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy,
  signal, computed, inject, NgZone
} from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as pdfjsLib from 'pdfjs-dist';
import { KhassidaDetail, VersAnnotation } from '../../core/models/khassida.model';
import { CatalogService } from '../../core/services/catalog.service';
import { take } from 'rxjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * Outil d'annotation manuelle des vers sur le PDF.
 * Pour chaque vers : sélectionner la page, cliquer le HAUT puis le BAS du vers.
 * Génère un JSON `annotations` à coller dans {id}.json.
 *
 * Route protégée : /annotate/:id
 */
@Component({
  selector: 'app-annotate',
  standalone: true,
  imports: [RouterModule],
  styles: [`
    :host { display: block; height: 100vh; }
    .pdf-wrap { position: relative; display: inline-block; cursor: crosshair; }
    .guide {
      position: absolute; left: 0; right: 0; height: 2px;
      background: var(--c-accent); pointer-events: none;
    }
    .pending-line {
      position: absolute; left: 0; right: 0; height: 2px;
      background: #e11d48; pointer-events: none;
    }
    .saved-zone {
      position: absolute; left: 0; right: 0; pointer-events: none;
      background: color-mix(in srgb, var(--c-accent) 16%, transparent);
      border-top: 1.5px solid var(--c-accent);
      border-bottom: 1.5px solid var(--c-accent);
    }
    .saved-label {
      position: absolute; left: 4px; font-size: 10px; font-weight: 700;
      color: #fff; background: var(--c-accent); padding: 1px 5px;
      border-radius: 3px; pointer-events: none;
    }
  `],
  template: `
    <div class="h-screen flex flex-col c-bg">
      <!-- Header -->
      <header class="app-header shrink-0 flex items-center gap-3 px-4 py-2.5">
        <a routerLink="/" class="btn-nav w-8 h-8">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M9 1L3 6l6 5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          </svg>
        </a>
        <div class="flex-1">
          <p class="font-display text-xs tracking-widest uppercase c-text-1">Annotation · {{ id }}</p>
          <p class="font-display text-[9px] tracking-wider uppercase c-text-3">
            Vers {{ currentVers() }} / {{ maxVers() }} · page {{ currentPage() }}
          </p>
        </div>
        <button class="btn-nav w-8 h-8" (click)="changePage(-1)" [disabled]="currentPage() <= 1">‹</button>
        <span class="font-display text-[10px] c-text-3 w-10 text-center">{{ currentPage() }}/{{ totalPages() }}</span>
        <button class="btn-nav w-8 h-8" (click)="changePage(1)" [disabled]="currentPage() >= totalPages()">›</button>
      </header>

      <div class="flex-1 min-h-0 flex">
        <!-- PDF area -->
        <div #scrollContainer class="flex-1 overflow-auto p-3 flex items-start justify-center">
          <div #pdfWrap class="pdf-wrap" (click)="onClick($event)" (mousemove)="onMove($event)">
            <canvas #pdfCanvas style="display:block; box-shadow:0 2px 16px rgba(0,0,0,.12)"></canvas>

            <!-- Guide line (suit la souris) -->
            <div class="guide" [style.top.px]="guideY()"></div>

            <!-- Pending top click -->
            @if (pendingTop() !== null) {
              <div class="pending-line" [style.top.px]="pendingTop()!"></div>
            }

            <!-- Zones déjà annotées sur cette page -->
            @for (a of pageAnnotations(); track a.vers) {
              <div class="saved-zone"
                   [style.top.px]="a.yStart * canvasH()"
                   [style.height.px]="(a.yEnd - a.yStart) * canvasH()"></div>
              <div class="saved-label" [style.top.px]="a.yStart * canvasH() + 2">v{{ a.vers }}</div>
            }
          </div>
        </div>

        <!-- Sidebar -->
        <aside class="w-72 shrink-0 flex flex-col gap-4 p-4 overflow-y-auto"
               style="border-left:1px solid var(--c-border)">

          <div class="p-3 rounded-lg" style="background:var(--c-accent-bg); border:1px solid var(--c-accent)">
            <p class="font-display text-[10px] tracking-wider uppercase c-accent mb-1">Vers en cours</p>
            <p class="font-display text-3xl c-text-1">{{ currentVers() }}</p>
            <p class="font-serif c-text-3 mt-1" style="font-size:.8rem">
              @if (pendingTop() === null) {
                Clique le <b>HAUT</b> du vers
              } @else {
                Clique le <b>BAS</b> du vers
              }
            </p>
          </div>

          <div class="flex gap-2">
            <button class="rep-btn flex-1" (click)="prevVers()" [disabled]="currentVers() <= 1">‹ Préc.</button>
            <button class="rep-btn flex-1" (click)="nextVers()">Suiv. ›</button>
          </div>

          @if (pendingTop() !== null) {
            <button class="rep-btn" (click)="cancelPending()" style="border-color:#e11d48; color:#e11d48">
              Annuler le point haut
            </button>
          }

          <div class="h-px" style="background:var(--c-border)"></div>

          <div class="flex items-center justify-between">
            <p class="font-display text-[10px] tracking-wider uppercase c-text-3">
              Annotés : {{ annotations().length }} / {{ maxVers() }}
            </p>
            <button class="rep-btn" (click)="copyJson()" [disabled]="annotations().length === 0"
                    style="padding:.3rem .6rem">
              Copier JSON
            </button>
          </div>

          <!-- liste -->
          <div class="flex flex-col gap-1 overflow-y-auto" style="max-height:30vh">
            @for (a of annotations(); track a.vers) {
              <div class="flex items-center justify-between px-2 py-1 rounded"
                   style="background:var(--c-muted); font-size:.8rem"
                   [style.outline]="a.vers === currentVers() ? '1px solid var(--c-accent)' : 'none'">
                <span class="font-serif c-text-2">v{{ a.vers }} · p{{ a.page }}</span>
                <button (click)="deleteAnnotation(a.vers)" class="c-text-3" style="font-size:1rem; line-height:1">×</button>
              </div>
            }
          </div>

          @if (copied()) {
            <p class="font-serif c-accent text-center" style="font-size:.8rem">✓ JSON copié dans le presse-papier</p>
          }
        </aside>
      </div>
    </div>
  `,
})
export class AnnotateComponent implements AfterViewInit, OnDestroy {
  @ViewChild('pdfCanvas')       canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pdfWrap')         wrapRef!: ElementRef<HTMLDivElement>;
  @ViewChild('scrollContainer') scrollRef!: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private catalog = inject(CatalogService);
  private zone = inject(NgZone);

  id = '';
  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;

  currentPage = signal(1);
  totalPages  = signal(0);
  currentVers = signal(1);
  maxVers     = signal(1);
  canvasH     = signal(0);
  guideY      = signal(0);
  pendingTop  = signal<number | null>(null); // px
  annotations = signal<VersAnnotation[]>([]);
  copied      = signal(false);

  pageAnnotations = computed(() =>
    this.annotations().filter(a => a.page === this.currentPage())
  );

  async ngAfterViewInit(): Promise<void> {
    this.id = this.route.snapshot.params['id'];

    // charge le detail (pour pré-remplir annotations existantes + nb vers)
    this.http.get<KhassidaDetail>(`assets/data/${this.id}.json`).pipe(take(1)).subscribe(d => {
      this.maxVers.set(d.nb_vers);
      if (d.annotations?.length) this.annotations.set([...d.annotations]);
    });

    // charge le PDF depuis l'URL R2 du catalogue
    this.catalog.getById(this.id).pipe(take(1)).subscribe(async info => {
      if (!info) return;
      try {
        this.pdfDoc = await pdfjsLib.getDocument({ url: info.pdfUrl, withCredentials: false }).promise;
        this.zone.run(() => {
          this.totalPages.set(this.pdfDoc!.numPages);
          this.renderPage(1);
        });
      } catch (e) {
        console.error('[Annotate] PDF load error', e);
      }
    });
  }

  private async renderPage(p: number): Promise<void> {
    if (!this.pdfDoc) return;
    this.currentPage.set(p);
    const page = await this.pdfDoc.getPage(p);
    const cw = this.scrollRef.nativeElement.clientWidth - 24;
    const vp0 = page.getViewport({ scale: 1 });
    const scale = Math.min(cw / vp0.width, 1.5);
    const vp = page.getViewport({ scale });

    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(vp.width * dpr);
    canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width = vp.width + 'px';
    canvas.style.height = vp.height + 'px';
    this.canvasH.set(vp.height);

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
  }

  changePage(d: number): void {
    const p = this.currentPage() + d;
    if (p < 1 || p > this.totalPages()) return;
    this.pendingTop.set(null);
    this.renderPage(p);
  }

  onMove(e: MouseEvent): void {
    const rect = this.wrapRef.nativeElement.getBoundingClientRect();
    this.guideY.set(e.clientY - rect.top);
  }

  onClick(e: MouseEvent): void {
    const rect = this.wrapRef.nativeElement.getBoundingClientRect();
    const y = e.clientY - rect.top;

    if (this.pendingTop() === null) {
      this.pendingTop.set(y);
    } else {
      const top = this.pendingTop()!;
      const yStart = Math.min(top, y) / this.canvasH();
      const yEnd   = Math.max(top, y) / this.canvasH();
      this.saveAnnotation(yStart, yEnd);
      this.pendingTop.set(null);
      // avance auto au vers suivant (pas de plafond pour pouvoir finir)
      this.currentVers.update(v => v + 1);
    }
  }

  private saveAnnotation(yStart: number, yEnd: number): void {
    const ann: VersAnnotation = {
      vers: this.currentVers(),
      page: this.currentPage(),
      yStart: +yStart.toFixed(4),
      yEnd:   +yEnd.toFixed(4),
    };
    this.annotations.update(list => {
      const filtered = list.filter(a => a.vers !== ann.vers);
      return [...filtered, ann].sort((a, b) => a.vers - b.vers);
    });
  }

  cancelPending(): void { this.pendingTop.set(null); }

  prevVers(): void { if (this.currentVers() > 1) { this.currentVers.update(v => v - 1); this.pendingTop.set(null); } }
  nextVers(): void { this.currentVers.update(v => v + 1); this.pendingTop.set(null); }

  deleteAnnotation(vers: number): void {
    this.annotations.update(list => list.filter(a => a.vers !== vers));
  }

  copyJson(): void {
    const json = JSON.stringify(this.annotations(), null, 2);
    navigator.clipboard.writeText(`"annotations": ${json},`).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    });
  }

  ngOnDestroy(): void {}
}
