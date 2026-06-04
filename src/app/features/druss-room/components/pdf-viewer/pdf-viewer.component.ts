import {
  Component, Input, OnChanges, SimpleChanges, OnDestroy,
  ElementRef, ViewChild, AfterViewInit, signal, NgZone, inject, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

type ViewerMode = 'loading' | 'canvas' | 'iframe' | 'error';

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`:host { display: flex; flex-direction: column; height: 100%; }`],
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

        <!-- Zoom controls -->
        @if (mode() === 'canvas') {
          <div class="flex items-center gap-1">
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
              (click)="resetZoom()"
              title="Réinitialiser"
            >{{ zoomLabel() }}</button>

            <button class="btn-nav w-7 h-7" (click)="zoomIn()" [disabled]="zoomIndex() >= maxZoomIndex" title="Zoomer">
              <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor">
                <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <line x1="6" y1="3.5" x2="6" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="3.5" y1="6" x2="8.5" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="9.5" y1="10" x2="13" y2="13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        }
      </div>

      <!-- Viewer area -->
      <div #scrollContainer
           class="flex-1 min-h-0 relative rounded-lg"
           style="border:1px solid var(--c-border); background:var(--c-surface); overflow:auto">

        <!-- Spinner -->
        @if (mode() === 'loading') {
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div class="spinner"></div>
            <span class="font-display text-[10px] tracking-widest uppercase c-text-3">Chargement…</span>
          </div>
        }

        <!-- Canvas centré dans le scroll container -->
        @if (mode() === 'canvas' || mode() === 'loading') {
          <div class="flex items-start justify-center min-h-full p-2">
            <canvas #pdfCanvas
              style="display:block; box-shadow: 0 2px 16px rgba(0,0,0,0.12)"
              [class.invisible]="mode() !== 'canvas'">
            </canvas>
          </div>
        }

        <!-- Iframe fallback -->
        @if (mode() === 'iframe' && iframeSrc()) {
          <iframe [src]="iframeSrc()!" class="w-full h-full border-0" title="PDF"></iframe>
        }

        <!-- Error -->
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
  @ViewChild('pdfCanvas')    canvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('scrollContainer') scrollRef?: ElementRef<HTMLDivElement>;

  private zone = inject(NgZone);
  private sanitizer = inject(DomSanitizer);

  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  private renderTask: pdfjsLib.RenderTask | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private loadTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingUrl = '';
  private viewReady = false;
  private containerWidth = 0;

  mode        = signal<ViewerMode>('loading');
  currentPage = signal(1);
  totalPages  = signal(0);
  iframeSrc   = signal<SafeResourceUrl | null>(null);
  zoomIndex   = signal(2); // index 2 = 1.0 dans ZOOM_STEPS

  readonly maxZoomIndex = ZOOM_STEPS.length - 1;

  get zoomFactor(): number { return ZOOM_STEPS[this.zoomIndex()]; }
  get zoomLabel(): () => string { return () => Math.round(ZOOM_STEPS[this.zoomIndex()] * 100) + '%'; }

  zoomIn():    void { if (this.zoomIndex() < this.maxZoomIndex) { this.zoomIndex.update(i => i + 1); this.renderPage(this.currentPage()); } }
  zoomOut():   void { if (this.zoomIndex() > 0)                { this.zoomIndex.update(i => i - 1); this.renderPage(this.currentPage()); } }
  resetZoom(): void { this.zoomIndex.set(2); this.renderPage(this.currentPage()); }

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
    const url = changes['pdfUrl']?.currentValue as string;
    if (!url) return;
    if (this.viewReady) this.loadPdf(url);
    else this.pendingUrl = url;
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
        this.renderPage(1);
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
    // Fit to full width, then multiply by zoomFactor
    const fitScale = (cw - 16) / vp0.width;
    const scale    = fitScale * this.zoomFactor;
    const vp       = page.getViewport({ scale });

    const canvas = this.canvasRef.nativeElement;
    const dpr    = window.devicePixelRatio || 1;
    canvas.width  = Math.floor(vp.width  * dpr);
    canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width  = vp.width  + 'px';
    canvas.style.height = vp.height + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    this.renderTask = page.render({ canvas, canvasContext: ctx, viewport: vp });
    try {
      await this.renderTask.promise;
      this.zone.run(() => this.mode.set('canvas'));
    } catch { /* cancelled */ }
  }

  private clearTimeout(): void {
    if (this.loadTimeout) { clearTimeout(this.loadTimeout); this.loadTimeout = null; }
  }

  ngOnDestroy(): void {
    this.clearTimeout();
    this.resizeObserver?.disconnect();
  }
}
