// Promise.try polyfill — required by pdfjs-dist v6+
if (typeof (Promise as any).try === 'undefined') {
  (Promise as any).try = function <T>(fn: (...args: unknown[]) => T, ...args: unknown[]): Promise<T> {
    return new Promise<T>((resolve) => resolve(fn(...args)));
  };
}

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
