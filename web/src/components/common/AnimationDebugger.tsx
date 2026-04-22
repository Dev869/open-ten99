import { useEffect, useState } from 'react';

interface AnimatedHit {
  selector: string;
  className: string;
  animationName: string;
  rect: { top: number; left: number; width: number; height: number };
  borderRadius: string;
}

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
  const cls = (el as HTMLElement).className && typeof (el as HTMLElement).className === 'string'
    ? '.' + ((el as HTMLElement).className as string).split(/\s+/).filter(Boolean).slice(0, 3).join('.')
    : '';
  return `${tag}${id}${cls}`;
}

function scan(): AnimatedHit[] {
  const hits: AnimatedHit[] = [];
  const all = document.querySelectorAll<HTMLElement>('body *');
  all.forEach((el) => {
    const cs = window.getComputedStyle(el);
    const name = cs.animationName;
    if (!name || name === 'none') return;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    hits.push({
      selector: describeElement(el),
      className: typeof el.className === 'string' ? el.className : '',
      animationName: name,
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      borderRadius: cs.borderRadius,
    });
  });
  return hits;
}

export function AnimationDebugger() {
  const enabled = (() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debugAnim') === '1';
  })();
  const [hits, setHits] = useState<AnimatedHit[]>([]);
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<AnimatedHit[] | null>(null);

  useEffect(() => {
    if (!enabled || paused) return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 80) {
        setHits(scan());
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, paused]);

  if (!enabled) return null;

  const display = frozen ?? hits;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {display.map((h, i) => {
        const isCircular = h.borderRadius.includes('9999') || h.borderRadius.includes('50%');
        return (
          <div
            key={i}
            style={{
              position: 'fixed',
              top: h.rect.top,
              left: h.rect.left,
              width: h.rect.width,
              height: h.rect.height,
              border: `2px solid ${isCircular ? '#ff3b30' : '#ffcc00'}`,
              borderRadius: h.borderRadius,
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          />
        );
      })}

      <div
        className="fixed top-2 left-1/2 -translate-x-1/2 max-w-[720px] w-[min(720px,95vw)] max-h-[40vh] overflow-auto bg-black/85 text-white text-[11px] font-mono rounded-lg p-3 shadow-2xl"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <strong className="text-[13px]">animation debugger</strong>
          <span className="opacity-60">({display.length} animated)</span>
          <button
            className="ml-auto px-2 py-0.5 rounded bg-white/10 hover:bg-white/20"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? 'resume' : 'pause scan'}
          </button>
          <button
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20"
            onClick={() => setFrozen(frozen ? null : hits)}
          >
            {frozen ? 'unfreeze' : 'freeze frame'}
          </button>
          <button
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20"
            onClick={() => {
              console.table(display);
            }}
          >
            log
          </button>
        </div>
        <ul className="space-y-1">
          {display.map((h, i) => {
            const isCircular = h.borderRadius.includes('9999') || h.borderRadius.includes('50%');
            return (
              <li key={i} className="truncate">
                <span style={{ color: isCircular ? '#ff6b6b' : '#ffd36e' }}>●</span>{' '}
                <span className="opacity-80">{h.animationName}</span>{' '}
                <span>{Math.round(h.rect.width)}×{Math.round(h.rect.height)}</span>{' '}
                <span className="opacity-60">@ {Math.round(h.rect.left)},{Math.round(h.rect.top)}</span>{' '}
                <span className="opacity-70">r={h.borderRadius}</span>{' '}
                <span className="opacity-90">{h.selector}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 opacity-60">
          Red outline = circular (rounded-full). Yellow = any other animated element. Append
          <code className="mx-1 px-1 bg-white/10 rounded">?debugAnim=1</code> to any URL to enable.
        </p>
      </div>
    </div>
  );
}

