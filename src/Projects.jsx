import React from 'react';
import './projects.css';

const projects = [
  {
    id: 'xphire',
    name: 'Xphire',
    href: 'https://xphire.animesh-23gcebds018.workers.dev',
    linkLabel: 'Visit project',
    description: 'An AI-powered job scout that gathers openings, enriches listings, and delivers curated email digests. A terminal-inspired home for your next opportunity.',
    caption: 'Find your next beginning.',
    category: 'AI job discovery',
    technologies: 'React · Python · Gemini · Supabase',
    alt: 'Xphire editorial artwork: violet signal paths converging on a bright central star.',
  },
  {
    id: 'verabot',
    name: 'Verabot',
    href: 'https://github.com/trippinganymess/verabot',
    description: 'Explore Verabot’s source code, documentation, and latest development on GitHub.',
    caption: 'Verabot / source & exploration',
    category: 'Cloud agent',
    technologies: 'FastAPI · Hugging Face · Semantic similarity · LLM reasoning',
    alt: 'Verabot editorial artwork: a luminous mint sphere surrounded by delicate orbital lines.',
  },
  {
    id: 'lca',
    name: 'LCA',
    href: 'https://www.sunchillflower.me',
    linkLabel: 'Visit project',
    description: 'A shared space for coding practice. Build learning roadmaps, work through problems with your group, and follow everyone’s progress through activity heatmaps.',
    caption: 'Small steps. Shared progress.',
    category: 'Collaborative learning',
    technologies: 'React · TypeScript · Spring Boot',
    alt: 'LCA editorial artwork: a terracotta landscape of connected steps and rising learning paths.',
  },
  {
    id: 'ae-tcn-sf-soinn-ids',
    name: 'AE_TCN_SF_SOINN-IDS',
    href: 'https://github.com/GOOD-DAY-ON-MONDAY/AE_TCN_SF_SOINN-IDS',
    description: 'A continual-learning framework for network intrusion detection. An autoencoder, temporal convolutional network, and incremental learner work together to identify known attacks and explore unseen threats.',
    caption: 'Learning from the unknown.',
    category: 'Machine learning research',
    technologies: 'Autoencoder · TCN · SF-SOINN',
    alt: 'Network intrusion detection editorial artwork: blue data streams passing through three layers of a learning network.',
  },
];

export default function Projects({ navigation }) {
  return (
    <main className="games-page projects-page">
      <a className="return-home" href="/">
        <span className="back-arrow" aria-hidden="true">←</span>
        <span>Home</span>
      </a>

      {navigation}

      <section className="games-introduction" aria-labelledby="projects-title">
        <header className="games-heading">
          <p lang="hi">प्रोजैक्ट</p>
          <h1 id="projects-title">Projects<span className="games-count">04</span></h1>
        </header>
        <p className="games-description">Ideas made into things.<br />A few things I’ve been building.</p>
      </section>

      <div className="projects-collection">
        {projects.map((project, index) => (
          <article className="game-card project-card" key={project.id} aria-labelledby={`${project.id}-title`}>
            <a className="game-preview project-preview" href={project.href} target="_blank" rel="noopener noreferrer" aria-label={`${project.linkLabel || 'View on GitHub'}: ${project.name} (opens in a new tab)`}>
              <img src={`/projects/${project.id}.svg`} alt={project.alt} width="1440" height="760" loading={index === 0 ? 'eager' : 'lazy'} decoding="async" />
              <span className="game-preview-caption">{project.caption}</span>
              <span className="game-preview-play" aria-hidden="true">↗</span>
            </a>

            <div className="game-card-details">
              <div className="game-card-title">
                <span className="game-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h2 id={`${project.id}-title`}>{project.name}</h2>
                  <p>{project.description}</p>
                </div>
              </div>
              <a className="game-launch" href={project.href} target="_blank" rel="noopener noreferrer" aria-label={`${project.linkLabel || 'View on GitHub'}: ${project.name} (opens in a new tab)`}>{project.linkLabel || 'View on GitHub'} <span aria-hidden="true">↗</span></a>
            </div>

            <div className="game-card-notes">
              <span>{project.category}</span>
              <span>{project.technologies}</span>
            </div>
          </article>
        ))}
      </div>

      <footer className="brand-signature">
        <div className="footer-rule" />
        <div className="signature-context">
          <p className="signature-wordmark"><span className="mess">MESS</span><span className="tripping">Tripping</span></p>
          <p className="page-context">MESSTripping / Projects</p>
        </div>
      </footer>
    </main>
  );
}
