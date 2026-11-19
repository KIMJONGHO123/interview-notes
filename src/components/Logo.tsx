/** 말풍선 + </> 로고 (public/favicon.svg 와 같은 그림) */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b34f5" />
          <stop offset="1" stopColor="#3f17d9" />
        </linearGradient>
      </defs>
      <path d="M32 26h19a10 10 0 0 1 10 10v6a10 10 0 0 1-8 9.8V58l-8-6H32a10 10 0 0 1-10-10v-6a10 10 0 0 1 10-10z" fill="#b4a7f5" />
      <path
        d="M14 10h22a11 11 0 0 1 11 11v9a11 11 0 0 1-11 11H19l-10 8 1.6-8.6A11 11 0 0 1 3 30v-9a11 11 0 0 1 11-11z"
        fill="url(#logo-g)"
      />
      <g fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 20.5l-5 5 5 5" />
        <path d="M28 18l-5.5 15" />
        <path d="M35.5 20.5l5 5-5 5" />
      </g>
      <g stroke="#fbbc05" strokeWidth="3.5" strokeLinecap="round">
        <path d="M52 3l-2 5" />
        <path d="M59 9l-5 3" />
      </g>
    </svg>
  );
}
