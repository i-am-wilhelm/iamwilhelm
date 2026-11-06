/**
 * THE UNSEEN ONE: the seat-mirror. A black glass panel, a DOM div on
 * purpose (a reflective surface would be the wrong move). The sheen follows
 * the pointer; once revealed, the word appears mirror-reversed and rights
 * itself over the CSS transition.
 */

export interface Mirror {
  root: HTMLElement;
  /** Light the word: reversed first, then righted. */
  reveal(): void;
}

export function mountMirror(host: HTMLElement): Mirror {
  host.classList.add('mirror');
  const word = host.querySelector<HTMLElement>('.seat-mirror__word');
  if (word) word.classList.add('word');

  const sheen = document.createElement('div');
  sheen.className = 'sheen';
  const edge = document.createElement('div');
  edge.className = 'edge';
  host.prepend(sheen);
  host.append(edge);

  host.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect();
    host.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    host.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  });

  return {
    root: host,
    reveal() {
      host.classList.add('on');
    },
  };
}
