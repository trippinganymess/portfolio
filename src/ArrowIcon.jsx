import React from 'react';

export default function ArrowIcon({ direction = 'up-right', className = '' }) {
  return (
    <svg
      className={`arrow-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <use href={`/icons/arrows.svg#${direction}`} />
    </svg>
  );
}
