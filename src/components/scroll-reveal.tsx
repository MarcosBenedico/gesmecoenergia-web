'use client';

import { useEffect, useRef, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'left' | 'right';
}

export function ScrollReveal({ children, className = '', delay = 0, direction = 'up' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add('sr-visible'), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  const transform = direction === 'left'
    ? 'translateX(-24px)'
    : direction === 'right'
    ? 'translateX(24px)'
    : 'translateY(24px)';

  return (
    <div
      ref={ref}
      className={`sr-element ${className}`}
      style={{ '--sr-transform': transform } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
