import React from 'react';
import PageLayout from './PageLayout';
import ArrowIcon from './ArrowIcon';
import './socials.css';

const profiles = [
  { name: 'GitHub', logo: 'github', handle: 'trippinganymess', href: 'https://github.com/trippinganymess' },
  { name: 'X', logo: 'x-twitter', handle: '@animeshclouds', href: 'https://x.com/animeshclouds' },
  { name: 'LinkedIn', logo: 'linkedin', handle: 'Animesh Tripathi', href: 'https://www.linkedin.com/in/animesh-tripathi-420085295/' },
  { name: 'Instagram', logo: 'instagram', handle: '@riot0n', href: 'https://www.instagram.com/riot0n/' },
  { name: 'Spotify', logo: 'spotify', handle: 'My listening corner', href: 'https://open.spotify.com/user/31jujowcq52rkh336haxo6tkz5wi' },
];

export default function Socials({ navigation, embedded = false }) {
  const Heading = embedded ? 'h2' : 'h1';
  return (
    <PageLayout className="games-page socials-page" titleId="socials-title" pageName="Socials" navigation={navigation} embedded={embedded} sectionId="socials">
      <section className="games-introduction" aria-labelledby="socials-title">
        <header className="games-heading">
          <p lang="hi">सोशल</p>
          <Heading id="socials-title">Socials</Heading>
        </header>
        <p className="games-description">Find me around the internet.</p>
      </section>

      <ul className="socials-list" role="list" aria-label="Social profiles">
        {profiles.map(({ name, logo, handle, href }) => (
          <li key={name}>
            <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${name}: ${handle} (opens in a new tab)`}>
              <span className="socials-name">
                <img className="socials-logo" src={`/socials/${logo}.svg`} width="32" height="32" alt="" aria-hidden="true" />
                {name}
              </span>
              <span className="socials-handle">{handle}</span>
              <ArrowIcon className="socials-arrow" />
            </a>
          </li>
        ))}
      </ul>
    </PageLayout>
  );
}
