import React from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';

export function BrandSignature({ pageName }) {
  return (
    <footer className="brand-signature">
      <hr className="footer-rule" aria-hidden="true" />
      <div className="signature-context">
        <p className="signature-wordmark"><span className="mess">MESS</span><span className="tripping">Tripping</span></p>
        <p className="page-context">MESSTripping / {pageName}</p>
      </div>
    </footer>
  );
}

export default function PageLayout({ className, navigation, titleId, pageName, embedded = false, sectionId, children, ...attributes }) {
  if (embedded) {
    return (
      <section id={sectionId} className={`scroll-section ${className}`} tabIndex={-1} aria-labelledby={titleId} {...attributes}>
        <div className="scroll-panel">
          <div className="page-content">{children}</div>
        </div>
      </section>
    );
  }

  return (
    <div className={className} {...attributes}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header scroll-header">
        {navigation}
      </header>

      <main id="main-content" className="page-content" tabIndex={-1} aria-labelledby={titleId}>
        {children}
      </main>

      {pageName && <BrandSignature pageName={pageName} />}
      <SpeedInsights />
    </div>
  );
}
