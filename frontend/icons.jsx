// Inline icon set. 16×16 viewBox, 1.5px strokes, currentColor.
// We avoid an icon font / external set to keep this self-contained and tunable.

const I = ({ d, fill = false, size = 14, sw = 1.4 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
       stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
       style={{ flex: 'none' }}>
    {Array.isArray(d) ? d.map((x, i) => (
      <path key={i} d={x} fill={fill ? 'currentColor' : 'none'} />
    )) : <path d={d} fill={fill ? 'currentColor' : 'none'} />}
  </svg>
);

const Icons = {
  search:   (p) => <I {...p} d={['M11 11l3 3', 'M7 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z']} />,
  play:     (p) => <I {...p} d="M4 3l9 5-9 5V3z" fill />,
  pause:    (p) => <I {...p} d={['M5 3v10', 'M11 3v10']} />,
  stop:     (p) => <I {...p} d="M4 4h8v8H4z" />,
  check:    (p) => <I {...p} d="M3 8.5L6.5 12 13 4.5" />,
  x:        (p) => <I {...p} d={['M4 4l8 8','M12 4l-8 8']} />,
  chevDown: (p) => <I {...p} d="M4 6l4 4 4-4" />,
  chevRight:(p) => <I {...p} d="M6 4l4 4-4 4" />,
  chevLeft: (p) => <I {...p} d="M10 4L6 8l4 4" />,
  arrowRight: (p) => <I {...p} d={['M3 8h10', 'M9 4l4 4-4 4']} />,
  plus:     (p) => <I {...p} d={['M8 3v10','M3 8h10']} />,
  filter:   (p) => <I {...p} d="M2 3h12l-4.5 6v4l-3-1V9L2 3z" />,
  download: (p) => <I {...p} d={['M8 2v8','M5 7l3 3 3-3','M2 13h12']} />,
  upload:   (p) => <I {...p} d={['M8 12V4','M5 7l3-3 3 3','M2 13h12']} />,
  copy:     (p) => <I {...p} d={['M5 5h7v9H5z','M3 3h7v2','M3 3v8h2']} />,
  beaker:   (p) => <I {...p} d={['M6 2v4L2.5 12.5A1 1 0 0 0 3.4 14h9.2a1 1 0 0 0 .9-1.5L10 6V2','M5 2h6']} />,
  dna:      (p) => <I {...p} d={['M4 2c0 4 8 4 8 8s-8 4-8 8','M12 2c0 4-8 4-8 8s8 4 8 8','M5 4h6','M5 12h6']} />,
  flask:    (p) => <I {...p} d={['M6 2h4','M6.5 2v4.5L3 13a1 1 0 0 0 .85 1.5h8.3A1 1 0 0 0 13 13L9.5 6.5V2','M4.5 9h7']} />,
  history:  (p) => <I {...p} d={['M2.5 8a5.5 5.5 0 1 0 1.6-3.9','M2 2v3h3','M8 4.5V8l2 2']} />,
  trash:    (p) => <I {...p} d={['M3 4h10','M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4','M4 4l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4']} />,
  settings: (p) => <I {...p} d={['M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z','M13 8a5 5 0 0 0-.1-.9l1.3-1-1-1.7-1.6.4a5 5 0 0 0-1.5-.9L9.7 2H6.3l-.3 1.6a5 5 0 0 0-1.5.9L2.9 4l-1 1.7 1.3 1A5 5 0 0 0 3 8a5 5 0 0 0 .1.9L1.8 9.9l1 1.7 1.6-.4a5 5 0 0 0 1.5.9l.3 1.6h3.4l.3-1.6a5 5 0 0 0 1.5-.9l1.6.4 1-1.7-1.3-1A5 5 0 0 0 13 8z']} />,
  warning:  (p) => <I {...p} d={['M8 2L1.5 13.5h13L8 2z','M8 6.5v3','M8 11.5v.1']} />,
  info:     (p) => <I {...p} d={['M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12z','M8 7v4','M8 5v.1']} />,
  bolt:     (p) => <I {...p} d="M9 2L3 9h4l-1 5 6-7H8l1-5z" />,
  external: (p) => <I {...p} d={['M9 3h4v4','M13 3L8 8','M13 9v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3']} />,
  drag:     (p) => <I {...p} d={['M6 3h.1','M6 8h.1','M6 13h.1','M10 3h.1','M10 8h.1','M10 13h.1']} sw={2.2} />,
  expand:   (p) => <I {...p} d={['M3 6V3h3','M13 6V3h-3','M3 10v3h3','M13 10v3h-3']} />,
  contract: (p) => <I {...p} d={['M3 3l4 4M7 3v4H3','M13 3l-4 4M9 3v4h4','M3 13l4-4M7 13V9H3','M13 13l-4-4M9 13V9h4']} />,
  sortDesc: (p) => <I {...p} d={['M4 4h8','M5 8h6','M6 12h4']} />,
  star:     (p) => <I {...p} d="M8 2l1.8 3.7 4.1.6-3 2.9.7 4.1-3.6-1.9-3.6 1.9.7-4.1-3-2.9 4.1-.6L8 2z" />,
  starFill: (p) => <I {...p} d="M8 2l1.8 3.7 4.1.6-3 2.9.7 4.1-3.6-1.9-3.6 1.9.7-4.1-3-2.9 4.1-.6L8 2z" fill />,
};

Object.assign(window, { Icons });
