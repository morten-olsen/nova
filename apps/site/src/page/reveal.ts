/**
 * Flips `data-reveal` to `shown` as elements enter the viewport.
 *
 * The transition itself lives in CSS behind `prefers-reduced-motion`, and the
 * attribute starts unset, so without this script or with reduced motion on
 * every section is simply visible.
 */
const startReveal = (): void => {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (targets.length === 0) {
    return;
  }

  if (!('IntersectionObserver' in window)) {
    for (const target of targets) {
      target.dataset.reveal = 'shown';
    }
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        (entry.target as HTMLElement).dataset.reveal = 'shown';
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
  );

  for (const target of targets) {
    observer.observe(target);
  }
};

export { startReveal };
