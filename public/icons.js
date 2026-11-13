// One icon set for every page. 24x24 box, 2 px stroke, round caps and joins, no fill, currentColor.
// ico('check') returns an SVG string; icoEl('check') returns an element; <svg data-i="check"></svg> is filled on load.
const ICONS = {
  back: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7', up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6', chev: 'M6 9l6 6 6-6', chevup: 'M6 15l6-6 6 6',
  bell: 'M6 16V11a6 6 0 1112 0v5l2 2H4zM10 21h4',
  almost: 'M3 9c3-3 6-3 9 0s6 3 9 0M3 15c3-3 6-3 9 0s6 3 9 0',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2', pause: 'M9 5v14M15 5v14', play: 'M8 5l11 7-11 7z',
  snow: 'M12 2v20M3.5 7l17 10M20.5 7l-17 10', screen: 'M3 5h18v11H3zM8 21h8M12 16v5', dots: 'M5 12h.01M12 12h.01M19 12h.01', list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', x: 'M6 6l12 12M18 6L6 18', check: 'M5 12.5l4.5 4.5L19 7.5', send: 'M7 4l13 8-13 8z',
  report: 'M8 4h8l3 3v13H5V4h3M9 12h6M9 16h6', trophy: 'M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 3M16 6h3a3 3 0 01-3 3M12 13v4M8 20h8',
  users: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 6.5M18 14.5a6.5 6.5 0 013.5 5.5',
  edit: 'M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z', trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', bolt: 'M13 3L5 13h6l-1 8 8-10h-6l1-8z',
  image: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4', qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM20 14v.01M14 20v.01',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1', phone: 'M8 3h8v18H8zM11 18h2',
  reset: 'M4 12a8 8 0 108-8H7M10 1L7 4l3 3',
  pen: 'M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z', eraser: 'M9 20h11M5.5 13.5l8-8a2 2 0 012.8 0l3.2 3.2a2 2 0 010 2.8L12 20H9l-3.5-3.7a2 2 0 010-2.8z',
  text: 'M5 7V4h14v3M12 4v16M9 20h6', shapes: 'M3 13h8v8H3zM17 3a4.5 4.5 0 110 9 4.5 4.5 0 010-9z', select: 'M4 4h3M10.5 4h3M17 4h3v3M20 10.5v3M20 17v3h-3M13.5 20h-3M7 20H4v-3M4 13.5v-3M4 7V4',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3', leave: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9',
  move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3', hand: 'M8 13V5.5a1.5 1.5 0 013 0V11M11 10V4.5a1.5 1.5 0 013 0V11M14 10V6a1.5 1.5 0 013 0v7a6 6 0 01-6 6h-1a6 6 0 01-5-3l-2-4a1.5 1.5 0 012.5-1.5L8 13',
  line: 'M5 19L19 5', arrow: 'M5 19L19 5M10 5h9v9', rect: 'M4 6h16v12H4z', ellipse: 'M12 5c5 0 9 3 9 7s-4 7-9 7-9-3-9-7 4-7 9-7z',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5', pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v8', folder: 'M3 6h6l2 2h10v11H3z', copy: 'M9 9h11v11H9zM5 15V4h11',
  front: 'M12 19V5M6 11l6-6 6 6M5 21h14', grab: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01', tri: 'M12 4l9 16H3z', diamond: 'M12 3l9 9-9 9-9-9z', star: 'M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z', dup: 'M9 9h11v11H9zM5 15V4h11',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01', file: 'M6 3h8l4 4v14H6zM14 3v4h4'
};
function ico(name, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ICONS[name] || '') + '"/></svg>'; }
function icoEl(name, cls) { const t = document.createElement('template'); t.innerHTML = ico(name, cls); return t.content.firstChild; }
function fillIcons(root) {
  (root || document).querySelectorAll('svg[data-i]').forEach(s => {
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.classList.add('i');
    s.innerHTML = '<path d="' + (ICONS[s.dataset.i] || '') + '"/>';
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => fillIcons()); else fillIcons();
