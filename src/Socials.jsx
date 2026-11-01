import React from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './socials.css';

const profiles = [
  { name: 'GitHub', logo: 'github', handle: 'trippinganymess', href: 'https://github.com/trippinganymess' },
  { name: 'X', logo: 'x-twitter', handle: '@animeshclouds', href: 'https://x.com/animeshclouds' },
  { name: 'LinkedIn', logo: 'linkedin', handle: 'Animesh Tripathi', href: 'https://www.linkedin.com/in/animesh-tripathi-420085295/' },
  { name: 'Instagram', logo: 'instagram', handle: '@riot0n', href: 'https://www.instagram.com/riot0n/' },
  { name: 'Spotify', logo: 'spotify', handle: 'My listening corner', href: 'https://open.spotify.com/user/31jujowcq52rkh336haxo6tkz5wi' },
];

export default function Socials({ navigation }) {
  return (
    <main className="games-page socials-page">
      <a className="return-home" href="/">
        <span className="back-arrow" aria-hidden="true">←</span>
        <span>Home</span>
      </a>

      {navigation}

      <section className="games-introduction" aria-labelledby="socials-title">
        <header className="games-heading">
          <p lang="hi">सोशल</p>
          <h1 id="socials-title">Socials</h1>
        </header>
        <p className="games-description">Find me around the internet.</p>
      </section>

      <ul className="socials-list" aria-label="Social profiles">
        {profiles.map(({ name, logo, handle, href }) => (
          <li key={name}>
            <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${name}: ${handle} (opens in a new tab)`}>
              <span className="socials-name">
                <img className="socials-logo" src={`/socials/${logo}.svg`} width="32" height="32" alt="" aria-hidden="true" />
                {name}
              </span>
              <span className="socials-handle">{handle}</span>
              <span className="socials-arrow" aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>

      <footer className="brand-signature">
        <div className="footer-rule" />
        <div className="signature-context">
          <p className="signature-wordmark"><span className="mess">MESS</span><span className="tripping">Tripping</span></p>
          <p className="page-context">MESSTripping / Socials</p>
        </div>
      </footer>
      <SpeedInsights />
    </main>
  );
}
