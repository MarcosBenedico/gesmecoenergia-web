'use client';

import { useEffect, useRef } from 'react';

interface Card3DProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

export function Card3D({ children, className = '', glowColor = '#6366f1' }: Card3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = (y - centerY) / 20;
      const rotateY = -(x - centerX) / 20;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(20px)`;
      card.style.boxShadow = `
        0 10px 40px rgba(0, 0, 0, 0.3),
        0 0 60px ${glowColor}40,
        inset 0 1px 0 rgba(255, 255, 255, 0.1)
      `;
    };

    const handleMouseLeave = () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
      card.style.boxShadow = `0 10px 30px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)`;
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [glowColor]);

  return (
    <div
      ref={cardRef}
      className={`rounded-2xl border border-accent/20 bg-gradient-to-br from-background/80 to-secondary/40 backdrop-blur-xl p-6 transition-all duration-300 ${className}`}
      style={{
        boxShadow: `0 10px 30px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
      }}
    >
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
