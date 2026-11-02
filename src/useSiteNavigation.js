import { useCallback, useEffect, useState } from 'react';

export function getPage(pathname) {
  if (/^\/games\/kill-a-spirit(?:\/(?:index\.html)?)?$/.test(pathname)) return 'game';
  const match = /^\/(biography|projects|socials|dreams|games)(?:\/|\.html)?$/.exec(pathname);
  if (match) return match[1] === 'games' ? 'dreams' : match[1];
  if (pathname === '/' || pathname === '/index.html') {
    return window.location.hostname === 'placeholder.biography.com' ? 'biography' : 'home';
  }
  return null;
}

export function useSiteNavigation() {
  const [location, setLocation] = useState({ pathname: window.location.pathname, navigated: false });

  const onNavigate = useCallback(event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // closest() also accepts click targets from the same-origin game frame.
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin || !getPage(url.pathname)) return;
    if (url.pathname === window.location.pathname && url.hash) return;
    event.preventDefault();
    if (url.href === window.location.href) return;
    window.history.pushState(null, '', url.href);
    setLocation({ pathname: url.pathname, navigated: true, resetScroll: true });
  }, []);

  useEffect(() => {
    const onPopState = () => setLocation({ pathname: window.location.pathname, navigated: true, resetScroll: false });
    document.addEventListener('click', onNavigate);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onNavigate);
      window.removeEventListener('popstate', onPopState);
    };
  }, [onNavigate]);

  useEffect(() => {
    if (!location.navigated) return;
    if (location.resetScroll) window.scrollTo(0, 0);
    const content = document.querySelector('main, .game-frame');
    if (content) {
      content.tabIndex = -1;
      content.focus({ preventScroll: true });
    }
  }, [location]);

  return { pathname: location.pathname, onNavigate };
}
