import { useEffect, useRef, useState } from 'react';

export function useScrollSections() {
  const mainRef = useRef(null);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const sections = [...mainRef.current.querySelectorAll('.scroll-section')];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const revealItems = [...mainRef.current.querySelectorAll(
      '.home-greeting-reveal, .biography-heading, .biography-portrait, .personal-introduction > p, .games-heading, .games-description, .project-card, .socials-list > li',
    )].map(element => {
      element.classList.add('scroll-reveal');
      return { element, top: 0, height: 0 };
    });
    const header = mainRef.current.parentElement.querySelector('.scroll-header');
    let headerHeight = 0;
    let frame = 0;

    function measure() {
      headerHeight = header?.offsetHeight || 0;
      for (const item of revealItems) {
        item.top = 0;
        item.height = item.element.offsetHeight;
        // Layout offsets stay stable while the panels and content translate.
        for (let node = item.element; node; node = node.offsetParent) item.top += node.offsetTop;
      }
      schedule();
    }

    function update() {
      frame = 0;
      const viewport = window.innerHeight;
      const transitionDistance = viewport * 0.55;
      const readingLine = viewport * 0.4;
      const remainingScroll = Math.max(0, document.documentElement.scrollHeight - viewport - window.scrollY);
      const finalProgress = Math.max(0, 1 - remainingScroll / (viewport * 0.3));
      let current = sections[0].id;

      for (const section of sections) {
        const bounds = section.getBoundingClientRect();
        const panel = section.firstElementChild;
        if (bounds.top <= readingLine) current = section.id;

        // Animate only the edges, so long sections remain still while being read.
        const entering = Math.max(0, Math.min(1, bounds.top / viewport));
        const leaving = Math.max(0, Math.min(1, (transitionDistance - bounds.bottom) / transitionDistance));
        const offset = motion.matches ? 0 : entering * entering * viewport * 0.16 - leaving * leaving * viewport * 0.3;
        panel.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
        panel.style.opacity = motion.matches ? '1' : String(1 - leaving * 0.85);
        panel.style.willChange = !motion.matches && bounds.top < viewport && bounds.bottom > 0 ? 'transform, opacity' : 'auto';
      }

      for (const item of revealItems) {
        const top = item.top - window.scrollY;
        const bottom = top + item.height;
        const entering = Math.max(0, Math.min(1, (viewport * 0.94 - top) / (viewport * 0.3)));
        const leaving = Math.max(0, Math.min(1, (bottom - headerHeight) / (viewport * 0.22)));
        // Finish revealing the last rows before the available scroll runs out.
        const fromBelow = Math.max(entering, top < viewport * 0.94 ? finalProgress : 0);
        const progress = motion.matches ? 1 : Math.min(fromBelow, leaving);
        const eased = progress * progress * (3 - 2 * progress);
        // Enter from below while scrolling down, or from above on the way back.
        const direction = leaving < fromBelow ? -1 : 1;
        item.element.style.setProperty('--reveal-opacity', eased.toFixed(3));
        item.element.style.setProperty('--reveal-offset', `${((1 - eased) * 36 * direction).toFixed(2)}px`);
      }

      setActiveSection(previous => previous === current ? previous : current);
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    const observer = new ResizeObserver(measure);
    sections.forEach(section => observer.observe(section));
    revealItems.forEach(({ element }) => observer.observe(element));
    if (header) observer.observe(header);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', measure);
    motion.addEventListener('change', schedule);
    measure();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
      motion.removeEventListener('change', schedule);
      for (const { element } of revealItems) {
        element.classList.remove('scroll-reveal');
        element.style.removeProperty('--reveal-opacity');
        element.style.removeProperty('--reveal-offset');
      }
    };
  }, []);

  return { mainRef, activeSection };
}
