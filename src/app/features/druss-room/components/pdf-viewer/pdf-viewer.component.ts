import {
  Component, Input, OnChanges, SimpleChanges, OnDestroy,
  ElementRef, ViewChild, AfterViewInit, signal, NgZone, inject, ChangeDetectionStrategy
} from '@angular/core';

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as pdfjsLib from 'pdfjs-dist';
import { HighlightZone } from '../../../../core/models/khassida.model';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

type ViewerMode = 'loading' | 'canvas' | 'iframe' | 'error';

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    @keyframes hlPulse {
      0%, 100% { opacity: 0.9; }
      50%      { opacity: 0.55; }
    }
    .hl-zone {
      position: absolute;
      left: 0; right: 0;
      pointer-events: none;
      border-radius: 4px;
      background: color-mix(in srgb, var(--c-accent) 18%, transparent);
      border: 1.5px solid color-mix(in srgb, var(--c-accent) 55%, transparent);
      box-shadow: 0 0 0 100vmax color-mix(in srgb, var(--c-bg) 0%, transparent);
      transition: top .35s cubic-bezier(.16,1,.3,1), height .35s cubic-bezier(.16,1,.3,1);
      animation: hlPulse 2.4s ease-in-out infinite;
    }
    /* Dim mask : assombrit tout sauf la zone active quand focus actif */
    .hl-marker {
      position: absolute;
      left: -4px;
      width: 3px;
      border-radius: 2px;
      background: var(--c-accent);
      pointer-events: none;
      transition: top .35s cubic-bezier(.16,1,.3,1), height .35s cubic-bezier(.16,1,.3,1);
    }
  `],
  template: `
    <div class="flex flex-col h-full gap-2">

      <!-- Toolbar -->
      <div class="shrink-0 flex items-center justify-between gap-2 px-1">

        <!-- Page nav -->
        <div class="flex items-center gap-1">
          <button class="btn-nav w-7 h-7" (click)="go(-1)" [disabled]="mode() !== 'canvas' || currentPage() <= 1">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
              <path d="M7 1L3 5l4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            </svg>
          </button>
          <span class="font-display text-[10px] tracking-wider c-text-3 w-16 text-center">
            @if (mode() === 'canvas' && totalPages() > 0) {
              {{ currentPage() }} / {{ totalPages() }}
            }
          </span>
          <button class="btn-nav w-7 h-7" (click)="go(1)" [disabled]="mode() !== 'canvas' || currentPage() >= totalPages()">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
              <path d="M3 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="flex items-center gap-1">
          <!-- Focus toggle (only if annotations exist) -->
          @if (canFocus) {
            <button class="btn-nav w-7 h-7" (click)="toggleFocus()"
                    [style.background]="focusEnabled() ? 'var(--c-accent-bg)' : ''"
                    [style.color]="focusEnabled() ? 'var(--c-accent)' : ''"
                    [style.borderColor]="focusEnabled() ? 'var(--c-accent)' : ''"
                    title="Suivi automatique du vers">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="8" cy="8" r="3"/>
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke-linecap="round"/>
              </svg>
            </button>
          }

          <!-- Zoom controls -->
          @if (mode() === 'canvas') {
            <button class="btn-nav w-7 h-7" (click)="zoomOut()" [disabled]="zoomIndex() <= 0" title="Dézoomer">
              <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor">
                <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <line x1="3.5" y1="6" x2="8.5" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="9.5" y1="10" x2="13" y2="13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            <button
              class="font-display text-[10px] tracking-wider c-text-3 w-12 text-center transition-colors"
              style="background:var(--c-muted); border:1px solid var(--c-border); border-radius:3px; padding:2px 0; cursor:pointer"
              (click)="resetZoom()" title="Réinitialiser"
            >{{ zoomLabel() }}</button>
            <button class="btn-nav w-7 h-7" (click)="zoomIn()" [disabled]="zoomIndex() >= maxZoomIndex" title="Zoomer">
              <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor">
                <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <line x1="6" y1="3.5" x2="6" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="3.5" y1="6" x2="8.5" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="9.5" y1="10" x2="13" y2="13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          }
        </div>
      </div>

      <!-- Viewer area -->
      <div #scrollContainer
           class="flex-1 min-h-0 relative rounded-lg"
           style="border:1px solid var(--c-border); background:var(--c-surface); overflow:auto">

        @if (mode() === 'loading') {
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div class="spinner"></div>
            <span class="font-display text-[10px] tracking-widest uppercase c-text-3">Chargement…</span>
          </div>
        }

        @if (mode() === 'canvas' || mode() === 'loading') {
          <div class="flex items-start justify-center min-h-full p-2">
            <!-- positioned wrapper : canvas + highlight overlay -->
            <div #canvasWrap style="position:relative; display:inline-block"
                 [class.invisible]="mode() !== 'canvas'">
              <canvas #pdfCanvas
                style="display:block; box-shadow: 0 2px 16px rgba(0,0,0,0.12)">
              </canvas>

              <!-- Highlight zone overlay -->
              @if (focusEnabled() && activeZone() && activeZone()!.page === currentPage()) {
                <div class="hl-marker"
                     [style.top.px]="zonePx().top"
                     [style.height.px]="zonePx().height"></div>
                <div class="hl-zone"
                     [style.top.px]="zonePx().top"
                     [style.height.px]="zonePx().height"></div>
              }
            </div>
          </div>
        }

        @if (mode() === 'iframe' && iframeSrc()) {
          <iframe [src]="iframeSrc()!" class="w-full h-full border-0" title="PDF"></iframe>
        }

        @if (mode() === 'error') {
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="c-text-3" style="opacity:0.4">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
            <p class="font-serif c-text-3" style="font-size:0.82rem">PDF non disponible</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class PdfViewerComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() pdfUrl = '';
  @Input() targetPage: number | null = null;
  @Input() highlightZone: HighlightZone | null = null;
  /** présence d'annotations → active le bouton focus */
  @Input() annotated = false;

  @ViewChild('pdfCanvas')       canvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('scrollContainer') scrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('canvasWrap')      wrapRef?: ElementRef<HTMLDivElement>;

  private zone = inject(NgZone);
  private sanitizer = inject(DomSanitizer);

  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  private renderTask: pdfjsLib.RenderTask | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private loadTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingUrl = '';
  private viewReady = false;
  private containerWidth = 0;
  private canvasCssHeight = 0;

  mode        = signal<ViewerMode>('loading');
  currentPage = signal(1);
  totalPages  = signal(0);
  iframeSrc   = signal<SafeResourceUrl | null>(null);
  zoomIndex   = signal(2);
  focusEnabled = signal(true);
  activeZone   = signal<HighlightZone | null>(null);
  private renderTick = signal(0); // force recompute zonePx after each render

  readonly maxZoomIndex = ZOOM_STEPS.length - 1;

  get canFocus(): boolean { return this.annotated; }
  get zoomFactor(): number { return ZOOM_STEPS[this.zoomIndex()]; }
  zoomLabel = () => Math.round(ZOOM_STEPS[this.zoomIndex()] * 100) + '%';

  /** convertit la zone normalisée en pixels CSS sur le canvas courant */
  zonePx = (): { top: number; height: number } => {
    this.renderTick(); // dépendance pour recalcul
    const z = this.activeZone();
    if (!z || this.canvasCssHeight === 0) return { top: 0, height: 0 };
    return {
      top:    z.yStart * this.canvasCssHeight,
      height: (z.yEnd - z.yStart) * this.canvasCssHeight,
    };
  };

  zoomIn():    void { if (this.zoomIndex() < this.maxZoomIndex) { this.zoomIndex.update(i => i + 1); this.renderPage(this.currentPage()); } }
  zoomOut():   void { if (this.zoomIndex() > 0)                { this.zoomIndex.update(i => i - 1); this.renderPage(this.currentPage()); } }
  resetZoom(): void { this.zoomIndex.set(2); this.renderPage(this.currentPage()); }
  toggleFocus(): void {
    this.focusEnabled.update(v => !v);
    if (this.focusEnabled()) this.scrollToZone();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.resizeObserver = new ResizeObserver(entries => {
      const newW = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(newW - this.containerWidth) > 10 && this.pdfDoc) {
        this.containerWidth = newW;
        this.renderPage(this.currentPage());
      }
    });
    const container = this.scrollRef?.nativeElement;
    if (container) this.resizeObserver.observe(container);
    if (this.pendingUrl) this.loadPdf(this.pendingUrl);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pdfUrl']?.currentValue) {
      const url = changes['pdfUrl'].currentValue as string;
      if (this.viewReady) this.loadPdf(url);
      else this.pendingUrl = url;
    }

    if (changes['highlightZone']) {
      this.activeZone.set(this.highlightZone);
    }

    // Navigation auto vers la page cible
    if (changes['targetPage'] && this.targetPage && this.pdfDoc) {
      const p = this.targetPage;
      if (p !== this.currentPage()) {
        this.renderPage(p).then(() => this.afterAutoNav());
      } else {
        this.afterAutoNav();
      }
    } else if (changes['highlightZone'] && this.focusEnabled()) {
      // même page, juste la zone a changé → scroll
      queueMicrotask(() => this.scrollToZone());
    }
  }

  private afterAutoNav(): void {
    if (this.focusEnabled()) {
      // laisser le rendu se poser puis scroller
      setTimeout(() => this.scrollToZone(), 120);
    }
  }

  go(delta: number): void {
    const next = this.currentPage() + delta;
    if (next < 1 || next > this.totalPages()) return;
    this.renderPage(next);
    this.scrollRef?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private async loadPdf(url: string): Promise<void> {
    this.mode.set('loading');
    this.currentPage.set(1);
    this.totalPages.set(0);
    this.pdfDoc = null;

    this.clearTimeout();
    this.loadTimeout = setTimeout(() => {
      this.zone.run(() => this.fallbackToIframe(url));
    }, 10000);

    try {
      this.pdfDoc = await pdfjsLib.getDocument({ url, withCredentials: false }).promise;
      this.clearTimeout();
      this.zone.run(() => {
        this.totalPages.set(this.pdfDoc!.numPages);
        const startPage = this.targetPage && this.targetPage >= 1 ? this.targetPage : 1;
        this.renderPage(startPage).then(() => this.afterAutoNav());
      });
    } catch (err) {
      console.error('[PDF] pdfjs error:', err);
      this.clearTimeout();
      this.zone.run(() => this.fallbackToIframe(url));
    }
  }

  private fallbackToIframe(url: string): void {
    this.iframeSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(`${url}#page=1`));
    this.mode.set('iframe');
  }

  private async renderPage(pageNum: number): Promise<void> {
    if (!this.pdfDoc || !this.canvasRef || !this.scrollRef) return;

    if (this.renderTask) { this.renderTask.cancel(); this.renderTask = null; }
    this.currentPage.set(pageNum);

    const page = await this.pdfDoc.getPage(pageNum);
    const container = this.scrollRef.nativeElement;
    const cw = container.clientWidth;
    if (cw < 10) { requestAnimationFrame(() => this.renderPage(pageNum)); return; }

    const vp0 = page.getViewport({ scale: 1 });
    const fitScale = (cw - 16) / vp0.width;
    const scale    = fitScale * this.zoomFactor;
    const vp       = page.getViewport({ scale });

    const canvas = this.canvasRef.nativeElement;
    const dpr    = window.devicePixelRatio || 1;
    canvas.width  = Math.floor(vp.width  * dpr);
    canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width  = vp.width  + 'px';
    canvas.style.height = vp.height + 'px';
    this.canvasCssHeight = vp.height;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    this.renderTask = page.render({ canvas, canvasContext: ctx, viewport: vp });
    try {
      await this.renderTask.promise;
      this.zone.run(() => {
        this.mode.set('canvas');
        this.renderTick.update(t => t + 1); // recalc zonePx
      });
    } catch { /* cancelled */ }
  }

  /** scroll le container pour centrer la zone active */
  private scrollToZone(): void {
    const z = this.activeZone();
    if (!z || z.page !== this.currentPage() || !this.scrollRef || !this.wrapRef) return;
    const container = this.scrollRef.nativeElement;
    const wrapTop = this.wrapRef.nativeElement.offsetTop;
    const zoneCenter = wrapTop + (z.yStart + (z.yEnd - z.yStart) / 2) * this.canvasCssHeight;
    const target = zoneCenter - container.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }

  private clearTimeout(): void {
    if (this.loadTimeout) { clearTimeout(this.loadTimeout); this.loadTimeout = null; }
  }

  ngOnDestroy(): void {
    this.clearTimeout();
    this.resizeObserver?.disconnect();
  }
}
