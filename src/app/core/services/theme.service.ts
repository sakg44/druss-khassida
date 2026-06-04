import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly KEY = 'druss-theme';

  isDark = signal(false);

  constructor() {
    const saved = localStorage.getItem(this.KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved ? saved === 'dark' : prefersDark;
    this.isDark.set(dark);
    this.apply(dark);

    effect(() => {
      const d = this.isDark();
      this.apply(d);
      localStorage.setItem(this.KEY, d ? 'dark' : 'light');
    });
  }

  toggle(): void { this.isDark.update(v => !v); }

  private apply(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark);
  }
}
