import React from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';

export default function PageLayout({ className, navigation, titleId, pageName, children, ...attributes }) {
  return (
    <div className={className} {...attributes}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        {pageName && (
          <a className="return-home" href="/">
            <span className="back-arrow" aria-hidden="true">←</span>
            <span>Home</span>
          </a>
        )}
        {navigation}
      </header>

      <main id="main-content" className="page-content" tabIndex={-1} aria-labelledby={titleId}>
        {children}
      </main>

      {pageName && (
        <footer className="brand-signature">
          <hr className="footer-rule" aria-hidden="true" />
          <div className="signature-context">
            <p className="signature-wordmark"><span className="mess">MESS</span><span className="tripping">Tripping</span></p>
            <p className="page-context">MESSTripping / {pageName}</p>
          </div>
        </footer>
      )}
      <SpeedInsights />
    </div>
  );
}
