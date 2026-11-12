/** Ancrum marks: headless mercat shaft on steps; Cross Keys; village scene. No heraldry. */

export function MarketCrossMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 92" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <ellipse cx="32" cy="86" rx="30" ry="5" fill="currentColor" opacity="0.45" />
      <ellipse cx="32" cy="79" rx="23" ry="4.5" fill="currentColor" opacity="0.65" />
      <ellipse cx="32" cy="72" rx="16" ry="4" fill="currentColor" opacity="0.82" />
      <rect x="20" y="56" width="24" height="14" rx="2" fill="currentColor" />
      <rect x="28" y="10" width="8" height="46" fill="currentColor" />
    </svg>
  )
}

export function CrossKeysMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 56 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="12" cy="14" r="5" />
        <path d="M17 14h28M39 14v4M43 14v4" />
        <g transform="rotate(-32 28 14)">
          <circle cx="12" cy="14" r="5" />
          <path d="M17 14h28M39 14v4M43 14v4" />
        </g>
      </g>
    </svg>
  )
}

export function VillageGreenScene({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 800 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      preserveAspectRatio="xMidYMax slice"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2430" />
          <stop offset="55%" stopColor="#243528" />
          <stop offset="100%" stopColor="#2f4a32" />
        </linearGradient>
        <linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d6b42" />
          <stop offset="100%" stopColor="#243528" />
        </linearGradient>
      </defs>
      <rect width="800" height="420" fill="url(#sky)" />
      <ellipse cx="90" cy="210" rx="70" ry="90" fill="#1e3224" opacity="0.85" />
      <ellipse cx="160" cy="200" rx="55" ry="75" fill="#26402c" opacity="0.8" />
      <ellipse cx="640" cy="195" rx="80" ry="95" fill="#1e3224" opacity="0.8" />
      <ellipse cx="720" cy="210" rx="60" ry="80" fill="#26402c" opacity="0.75" />
      <ellipse cx="400" cy="185" rx="50" ry="70" fill="#1a2e22" opacity="0.55" />
      <g transform="translate(40,160)">
        <path d="M0 90h120l-10-40H10L0 90z" fill="#5c6570" />
        <rect x="8" y="90" width="104" height="70" fill="#c9b8a0" />
        <rect x="22" y="108" width="18" height="24" fill="#2a2218" opacity="0.7" />
        <rect x="52" y="108" width="18" height="24" fill="#2a2218" opacity="0.55" />
        <rect x="82" y="108" width="18" height="24" fill="#2a2218" opacity="0.7" />
      </g>
      <g transform="translate(520,155)">
        <path d="M0 95h200l-12-45H12L0 95z" fill="#4a5560" />
        <rect x="10" y="95" width="180" height="85" fill="#9a5540" />
        <path d="M28 180v-40a18 18 0 0 1 36 0v40" fill="#2a1a14" opacity="0.55" />
        <rect x="80" y="118" width="22" height="28" fill="#2a1a14" opacity="0.55" />
        <rect x="120" y="118" width="22" height="28" fill="#2a1a14" opacity="0.55" />
        <rect x="108" y="100" width="28" height="16" rx="1" fill="#e8dcc4" />
      </g>
      <path d="M400 230 L780 420 L20 420 Z" fill="url(#green)" />
      <g transform="translate(400,250)">
        <ellipse cx="0" cy="118" rx="48" ry="10" fill="#6a7068" opacity="0.7" />
        <ellipse cx="0" cy="108" rx="38" ry="9" fill="#7a8078" opacity="0.8" />
        <ellipse cx="0" cy="98" rx="28" ry="8" fill="#8a9088" opacity="0.9" />
        <rect x="-14" y="72" width="28" height="22" rx="2" fill="#9aa094" />
        <rect x="-5" y="10" width="10" height="64" fill="#b8b6a8" />
        <rect x="-5" y="8" width="10" height="3" fill="#a8a698" />
      </g>
      <ellipse cx="400" cy="300" rx="180" ry="60" fill="#e6c27a" opacity="0.08" />
    </svg>
  )
}
