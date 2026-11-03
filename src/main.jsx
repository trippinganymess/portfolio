import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import PageLayout from './PageLayout';
import { SpeedInsights } from '@vercel/speed-insights/react';
import ArrowIcon from './ArrowIcon';
import Projects from './Projects';
import Socials from './Socials';
import Game from './Game';
import Fireflies from './Fireflies';
import { getPage, useSiteNavigation } from './useSiteNavigation';
import { useHomeAnimation } from './HomeAnimation';
import { useDreamsSpark } from './DreamsSpark';
import { useScrollSections } from './useScrollSections';
import './styles.css';
import './scroll-home.css';

const links = [
  { hindi: 'मेरे बारे में', english: 'About Me', href: '/#biography', source: 'https://placeholder.biography.com', node: '1:4' },
  { hindi: 'प्रोजैक्ट', english: 'Projects', href: '/#projects', node: '1:65' },
  { hindi: 'सोशल', english: 'Socials', href: '/#socials', node: '1:65' },
  { hindi: 'सपने', english: 'Dreams', href: '/dreams' },
];

function Navigation({ currentPage, sectionNavigation = false }) {
  const { linkRef, spark } = useDreamsSpark(currentPage !== 'Dreams');
  return (
    <nav className="navigation" aria-label="Portfolio">
      <ul role="list">
        {links.map(({ hindi, english, href, source, node }) => (
          <li key={english}>
            <a
              href={href}
              aria-current={currentPage === english ? (sectionNavigation ? 'location' : 'page') : undefined}
              data-node-id={node}
              data-figma-href={source || href}
              {...(english === 'Dreams' ? { ref: linkRef, className: 'dreams-link' } : {})}
            >
              <span lang="hi">{hindi}</span>
              <span className="navigation-english">{english}</span>
              {english === 'Dreams' && spark}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function HomeHero() {
  const greeting = 'HELLO WORLD!!';
  return (
    <PageLayout className="home" titleId="home-title" embedded sectionId="home" data-figma-page="placeholder.home.com">
      <div className="home-greeting-reveal">
        <h1 id="home-title" className="home-greeting" aria-label={greeting}>
          <span aria-hidden="true">
            {greeting.split(' ').map((word, wordIndex) => (
              <React.Fragment key={word}>
                {wordIndex > 0 && ' '}
                <span className="home-greeting-word">
                  {[...word].map((letter, index) => (
                    <span key={index} className="home-greeting-letter" style={{ '--letter-index': greeting.indexOf(word) + index }}>{letter}</span>
                  ))}
                </span>
              </React.Fragment>
            ))}
          </span>
        </h1>
      </div>
    </PageLayout>
  );
}

function Biography({ embedded = false }) {
  const Heading = embedded ? 'h2' : 'h1';
  return (
    <PageLayout className="biography" titleId="biography-title" pageName="About Me" embedded={embedded} sectionId="biography" data-figma-page="placeholder.biography.com" data-node-id="12:3">
      <section className="biography-introduction" aria-labelledby="biography-title" data-node-id="12:30">
        <header className="biography-heading" data-node-id="12:31">
          <p lang="hi" data-node-id="12:32">मेरे बारे में</p>
          <Heading id="biography-title" data-node-id="12:33">About Me</Heading>
        </header>
        <div className="biography-copy" data-node-id="12:34">
          <figure className="biography-portrait">
            <img src="/about/animesh-tripathi.png" alt="Portrait of Animesh Tripathi" width="500" height="500" />
          </figure>
          <div className="personal-introduction" data-node-id="12:38">
            <p data-node-id="12:39">I’m Animesh Tripathi. My practice brings together Machine learning, API development, and Design,  with a focus on Reliability and user experience.</p>
            <p data-node-id="12:40">I’m drawn to interactive creative designing . Here, I share what I am developing, the thinking behind it and some dreams.</p>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}

function Home() {
  const { mainRef, activeSection } = useScrollSections();
  const { animation } = useHomeAnimation({ persistent: true });
  const currentPage = { biography: 'About Me', projects: 'Projects', socials: 'Socials' }[activeSection];

  return (
    <div className="scroll-home">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header scroll-header">
        <Navigation currentPage={currentPage} sectionNavigation />
      </header>
      {animation}
      <main ref={mainRef} id="main-content" tabIndex={-1} aria-label="Animesh Tripathi portfolio">
        <HomeHero />
        <Biography embedded />
        <Projects embedded />
        <Socials embedded />
      </main>
      <SpeedInsights />
    </div>
  );
}

function Dreams() {
  return (
    <PageLayout className="games-page" titleId="games-title" pageName="Dreams" navigation={<Navigation currentPage="Dreams" />}>
      <section className="games-introduction" aria-labelledby="games-title">
        <header className="games-heading">
          <p lang="hi">सपने</p>
          <h1 id="games-title">Dreams<span className="games-count" aria-hidden="true">01</span></h1>
        </header>
        <p className="games-description">Little worlds to get lost in.<br />Stay a while. Play a little.</p>
      </section>

      <article className="game-card" aria-labelledby="spirit-title">
        <a className="game-preview" href="/games/kill-a-spirit/index.html" aria-label="Play Kill a Spirit">
          <img src="/games/kill-a-spirit/poster.svg" alt="A glowing chalk spirit above a Japanese lake, with rose-colored mountains, a twilight sun, and cherry blossom trees." width="1440" height="760" />
          <span className="game-preview-caption">A little strange. A little serene.</span>
          <span className="game-preview-play" aria-hidden="true"><ArrowIcon /></span>
        </a>

        <div className="game-card-details">
          <div className="game-card-title">
            <span className="game-number" aria-hidden="true">01</span>
            <div>
              <h2 id="spirit-title">Kill a Spirit</h2>
              <p>Chase a glow through a Japanese twilight dream. Each touch fades it further into the twilight.</p>
            </div>
          </div>
        </div>
        <footer className="game-card-notes">
          <span>3D · Pointer & touch</span>
          <span>Best with sound on</span>
        </footer>
      </article>
    </PageLayout>
  );
}

const pageTitles = {
  home: 'Animesh Tripathi',
  dreams: 'सपने Dreams — MESSTripping',
  game: 'Kill a Spirit — सपने Dreams — MESSTripping',
};

function App() {
  const { pathname, onNavigate } = useSiteNavigation();
  const page = getPage(pathname) || 'home';

  useEffect(() => {
    document.title = pageTitles[page];
  }, [page]);

  let content;
  if (page === 'dreams') content = <Dreams />;
  else if (page === 'game') content = <Game onNavigate={onNavigate} />;
  else content = <Home />;

  return (
    <>
      <Fireflies enabled={page !== 'game'} />
      {content}
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
