import { useCallback, useEffect, useState } from 'react';

export function getPage(pathname) {
  if (/^\/games\/kill-a-spirit(?:\/(?:index\.html)?)?$/.test(pathname)) return 'game';
  const match = /^\/(biography|projects|socials|dreams|games)(?:\/|\.html)?$/.exec(pathname);
  if (match) return ['games', 'dreams'].includes(match[1]) ? 'dreams' : 'home';
  if (pathname === '/' || pathname === '/index.html') {
    return 'home';
  }
  return null;
}

function readLocation() {
  const alias = /^\/(biography|projects|socials)(?:\/|\.html)?$/.exec(window.location.pathname);
  if (alias) window.history.replaceState(window.history.state, '', `/#${alias[1]}`);
  return { pathname: window.location.pathname, hash: window.location.hash };
}

export function useSiteNavigation() {
  const [location, setLocation] = useState(readLocation);

  const onNavigate = useCallback(event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // closest() also accepts click targets from the same-origin game frame.
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin || !getPage(url.pathname)) return;
    const alias = /^\/(biography|projects|socials)(?:\/|\.html)?$/.exec(url.pathname);
    if (alias) { url.pathname = '/'; url.hash = alias[1]; }
    if (url.hash && !['#home', '#biography', '#projects', '#socials'].includes(url.hash)) return;
    event.preventDefault();
    window.history.replaceState({ ...window.history.state, portfolioScroll: window.scrollY }, '', window.location.href);
    if (url.href !== window.location.href) window.history.pushState(null, '', url.href);
    setLocation({ pathname: url.pathname, hash: url.hash, navigated: true });
  }, []);

  useEffect(() => {
    const restoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const onPopState = () => setLocation({ ...readLocation(), scrollY: window.history.state?.portfolioScroll });
    document.addEventListener('click', onNavigate);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onNavigate);
      window.removeEventListener('popstate', onPopState);
      window.history.scrollRestoration = restoration;
    };
  }, [onNavigate]);

  useEffect(() => {
    let cancelled = false;
    let frame;
    function position() {
      if (cancelled) return;
      const section = location.hash && document.getElementById(location.hash.slice(1));
      const behavior = location.navigated && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant';
      if (Number.isFinite(location.scrollY)) window.scrollTo({ top: location.scrollY, behavior: 'instant' });
      else if (section) section.scrollIntoView({ behavior, block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
      if (location.navigated) {
        const content = section || document.querySelector('main');
        content?.focus({ preventScroll: true });
      }
    }
    frame = requestAnimationFrame(position);
    if (!location.navigated && location.hash && !Number.isFinite(location.scrollY)) document.fonts.ready.then(position);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [location]);

  return { pathname: location.pathname, onNavigate };
}
