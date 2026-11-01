import React from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './diary.css';

export default function Diary({ navigation }) {
  return (
    <main className="diary-page">
      <a className="return-home" href="/">
        <span className="back-arrow" aria-hidden="true">←</span>
        <span>Home</span>
      </a>

      {navigation}

      <header className="diary-heading">
        <p lang="hi">डायरी</p>
        <h1>Diary</h1>
      </header>

      <section className="diary-coming-soon" aria-labelledby="diary-blogs-title">
        <p className="diary-note">A few pages are taking shape.</p>
        <h2 id="diary-blogs-title">Blogs coming soon<span aria-hidden="true">.</span></h2>
        <p className="diary-description">Thoughts, stories, and notes will find a home here.</p>
      </section>

      <footer className="brand-signature">
        <div className="footer-rule" />
        <div className="signature-context">
          <p className="signature-wordmark"><span className="mess">MESS</span><span className="tripping">Tripping</span></p>
          <p className="page-context">MESSTripping / Diary</p>
        </div>
      </footer>
      <SpeedInsights />
    </main>
  );
}
