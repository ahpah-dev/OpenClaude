import React from 'react';

/**
 * Authentic Claude warm radial starburst icon (#D97757)
 */
export function ClaudeStarburst({ size = 24, animated = false, className = '' }) {
  const rays = 12;
  const lines = [];
  for (let i = 0; i < rays; i++) {
    const angle = (i * 360) / rays;
    // Slightly organic alternating ray lengths like Claude's organic sunburst
    const innerR = 2.6;
    const outerR = i % 2 === 0 ? 10.6 : 9.1;
    const rad = (angle * Math.PI) / 180;
    const x1 = 12 + innerR * Math.cos(rad);
    const y1 = 12 + innerR * Math.sin(rad);
    const x2 = 12 + outerR * Math.cos(rad);
    const y2 = 12 + outerR * Math.sin(rad);
    lines.push(
      <line
        key={i}
        x1={x1.toFixed(2)}
        y1={y1.toFixed(2)}
        x2={x2.toFixed(2)}
        y2={y2.toFixed(2)}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`${animated ? 'claude-starburst-thinking' : ''} ${className}`}
      aria-hidden="true"
    >
      <g stroke="var(--accent-claude)" strokeWidth="2.05" strokeLinecap="round">
        {lines}
      </g>
      <circle cx="12" cy="12" r="2.2" fill="var(--accent-claude)" />
    </svg>
  );
}

export function ArtifactCubeIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export function NineRouterBadgeIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.5 16.5C12.5 16.5 14.5 14.2 14.5 10.5C14.5 8.3 13.2 7 11.5 7C9.8 7 8.5 8.2 8.5 9.8C8.5 11.3 9.7 12.4 11.3 12.4C12.5 12.4 13.5 11.8 14.1 11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function OllamaIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 9V5a2 2 0 0 1 4 0v2h1a2 2 0 0 1 4 0v4c1.2.8 2 2.2 2 3.8V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4.2C5 13.2 5.8 11.8 7 11V9z" />
      <circle cx="9.5" cy="13.5" r="0.8" fill="currentColor" />
      <circle cx="14.5" cy="13.5" r="0.8" fill="currentColor" />
    </svg>
  );
}
