import React from 'react';
import { createRoot } from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Projects from './Projects';
import Socials from './Socials';
import Diary from './Diary';
import { useHomeAnimation } from './HomeAnimation';
import { ShaderEffect } from './lib/custom-effect-runtime/index';
import { setup, render, manifest } from './lib/custom-effects/CodeComponentId_91040247ba61849c1772a9a1caf10833c2700c71_8351';
import './styles.css';

const shaders = [{
  setup,
  render,
  manifest,
  params: {
    rotation: 0,
    colorMode: 0,
    dotScale: 1,
    centerPos: { x: 50, y: 50 },
    dotSize: 20,
    halftoneType: 1,
    clipToAlpha: false,
    softness: 0,
  },
}];

const links = [
  { hindi: 'आत्मकथा', english: 'Biography', href: '/biography', source: 'https://placeholder.biography.com', node: '1:4' },
  { hindi: 'प्रोजैक्ट', english: 'Projects', href: '/projects', node: '1:65' },
  { hindi: 'सोशल', english: 'Socials', href: '/socials', node: '1:65' },
  { hindi: 'डायरी', english: 'Diary', href: '/diary', node: '1:65' },
  { hindi: 'सपने', english: 'Dreams', href: '/dreams' },
];

function Navigation({ currentPage, dreamsLinkProps }) {
  return (
    <nav className="navigation" aria-label="Portfolio">
      {links.map(({ hindi, english, href, source, node }) => (
        <a
          key={english}
          href={href}
          aria-current={currentPage === english ? 'page' : undefined}
          data-node-id={node}
          data-figma-href={source || href}
          {...(english === 'Dreams' ? dreamsLinkProps : {})}
        >
          <span lang="hi">{hindi}</span>
          <span className="navigation-english">{english}</span>
        </a>
      ))}
    </nav>
  );
}

function Home() {
  const { dreamsLinkProps, animation } = useHomeAnimation();
  return (
    <main className="home" data-figma-page="placeholder.home.com">
      <Navigation dreamsLinkProps={dreamsLinkProps} />
      {animation}
      <div className="wordmark" data-node-id="1:61">
        <ShaderEffect className="wordmark-effect" shaders={shaders}>
          <h1 className="wordmark-text"><span className="mess">MESS</span><span className="tripping">Tripping</span></h1>
        </ShaderEffect>
      </div>
      <SpeedInsights />
    </main>
  );
}

function Biography() {
  return (
    <main className="biography" data-figma-page="placeholder.biography.com" data-node-id="12:3">
      <a className="return-home" href="/" data-node-id="12:4">
        <span className="back-arrow" aria-hidden="true" data-node-id="12:5">←</span>
        <span data-node-id="12:6">Home</span>
      </a>

      <Navigation currentPage="Biography" />

      <section className="biography-introduction" aria-labelledby="biography-title" data-node-id="12:30">
        <header className="biography-heading" data-node-id="12:31">
          <p lang="hi" data-node-id="12:32">आत्मकथा</p>
          <h1 id="biography-title" data-node-id="12:33">Biography</h1>
        </header>
        <div className="biography-copy" data-node-id="12:34">
          <div className="copy-guidance" data-node-id="12:35">
            <p data-node-id="12:36">For now</p>
            <p data-node-id="12:37">this is more about me than a biography </p>
          </div>
          <div className="personal-introduction" data-node-id="12:38">
            <p data-node-id="12:39">I’m Animesh Tripathi. My practice brings together Machine learning, API development, and Design,  with a focus on Reliability and user experience.</p>
            <p data-node-id="12:40">I’m drawn to interactive creative designing, . Here, I share what I am developing, the thinking behind it and some dreams.</p>
          </div>
        </div>
      </section>

      <footer className="brand-signature" data-node-id="12:41">
        <div className="footer-rule" data-node-id="12:42" />
        <div className="signature-context" data-node-id="12:43">
          <p className="signature-wordmark" data-node-id="12:44"><span className="mess">MESS</span><span className="tripping">Tripping</span></p>
          <p className="page-context" data-node-id="12:45">MESSTripping / Biography</p>
        </div>
      </footer>
      <SpeedInsights />
    </main>
  );
}

function Dreams() {
  return (
    <main className="games-page">
      <a className="return-home" href="/">
        <span className="back-arrow" aria-hidden="true">←</span>
        <span>Home</span>
      </a>

      <Navigation currentPage="Dreams" />

      <section className="games-introduction" aria-labelledby="games-title">
        <header className="games-heading">
          <p lang="hi">सपने</p>
          <h1 id="games-title">Dreams<span className="games-count">01</span></h1>
        </header>
        <p className="games-description">Little worlds to get lost in.<br />Stay a while. Play a little.</p>
      </section>

      <article className="game-card" aria-labelledby="spirit-title">
        <a className="game-preview" href="/games/kill-a-spirit/index.html" aria-label="Play Kill a Spirit">
          <img src="/games/kill-a-spirit/poster.svg" alt="A glowing chalk spirit above a Japanese lake, with rose-colored mountains, a twilight sun, and cherry blossom trees." width="1440" height="760" />
          <span className="game-preview-caption">A little strange. A little serene.</span>
          <span className="game-preview-play" aria-hidden="true">↗</span>
        </a>

        <div className="game-card-details">
          <div className="game-card-title">
            <span className="game-number">01</span>
            <div>
              <h2 id="spirit-title">Kill a Spirit</h2>
              <p>Chase a glow through a Japanese twilight dream. Each touch fades it further into the twilight.</p>
            </div>
          </div>
          <a className="game-launch" href="/games/kill-a-spirit/index.html">Enter the dream <span aria-hidden="true">↗</span></a>
        </div>
        <div className="game-card-notes">
          <span>3D · Pointer & touch</span>
          <span>Best with sound on</span>
        </div>
      </article>

      <footer className="brand-signature">
        <div className="footer-rule" />
        <div className="signature-context">
          <p className="signature-wordmark"><span className="mess">MESS</span><span className="tripping">Tripping</span></p>
          <p className="page-context">MESSTripping / Dreams</p>
        </div>
      </footer>
      <SpeedInsights />
    </main>
  );
}

const isBiography = window.location.hostname === 'placeholder.biography.com'
  || /^\/biography(?:\/|\.html)?$/.test(window.location.pathname);
const isDreams = /^\/(?:dreams|games)(?:\/|\.html)?$/.test(window.location.pathname);
const isProjects = /^\/projects(?:\/|\.html)?$/.test(window.location.pathname);
const isSocials = /^\/socials(?:\/|\.html)?$/.test(window.location.pathname);
const isDiary = /^\/diary(?:\/|\.html)?$/.test(window.location.pathname);
const isGame = /^\/games\/kill-a-spirit\/?$/.test(window.location.pathname);

if (isGame) {
  window.location.replace('/games/kill-a-spirit/index.html');
} else {
  document.title = isDiary ? 'डायरी Diary — MESSTripping' : isSocials ? 'सोशल Socials — MESSTripping' : isProjects ? 'प्रोजैक्ट Projects — MESSTripping' : isDreams ? 'सपने Dreams — MESSTripping' : isBiography ? 'Biography — MESSTripping' : 'MESSTripping';
  createRoot(document.getElementById('root')).render(isDiary ? <Diary navigation={<Navigation currentPage="Diary" />} /> : isSocials ? <Socials navigation={<Navigation currentPage="Socials" />} /> : isProjects ? <Projects navigation={<Navigation currentPage="Projects" />} /> : isDreams ? <Dreams /> : isBiography ? <Biography /> : <Home />);
}
