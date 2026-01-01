'use client';

// ============================================
// Falling L Effect Component
// ============================================

import { useEffect, useState } from 'react';
import type { LParticle } from '@/types/studio';

interface FallingLEffectProps {
  trigger: number; // Increment this to trigger animation
  duration?: number; // Total duration in ms
  particleCount?: number; // Number of L particles
}

export default function FallingLEffect({
  trigger,
  duration = 3000,
  particleCount = 25,
}: FallingLEffectProps) {
  const [particles, setParticles] = useState<LParticle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (trigger === 0) return; // Don't animate on initial mount

    // Generate particles
    const newParticles: LParticle[] = Array.from(
      { length: particleCount },
      (_, i) => ({
        id: `l-${trigger}-${i}`,
        x: Math.random() * 100, // 0-100%
        delay: Math.random() * 1000, // 0-1000ms
        size: 12 + Math.random() * 20, // 12-32px (smaller)
        duration: 2500 + Math.random() * 2000, // 2500-4500ms (slower fall)
        opacity: 0.3 + Math.random() * 0.3, // 0.3-0.6 (subtler)
        rotation: -15 + Math.random() * 30, // -15 to 15 degrees
      })
    );

    setParticles(newParticles);
    setIsAnimating(true);

    // Cleanup after animation completes
    const timer = setTimeout(() => {
      setIsAnimating(false);
      setParticles([]);
    }, duration);

    return () => clearTimeout(timer);
  }, [trigger, duration, particleCount]);

  if (!isAnimating) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-fall-and-fade"
          style={{
            left: `${particle.x}%`,
            top: '-50px',
            fontSize: `${particle.size}px`,
            animationDelay: `${particle.delay}ms`,
            animationDuration: `${particle.duration}ms`,
            opacity: particle.opacity,
            ['--rotate-end' as any]: `${particle.rotation}deg`,
          }}
        >
          <span
            className="font-bold bg-gradient-to-br from-blue-500 to-blue-700 bg-clip-text text-transparent"
            style={{
              textShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
              filter: 'drop-shadow(0 2px 8px rgba(59, 130, 246, 0.3))',
            }}
          >
            L
          </span>
        </div>
      ))}

      {/* Inline styles for animation */}
      <style jsx>{`
        @keyframes fall-and-fade {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(calc(100vh + 50px)) rotate(var(--rotate-end));
            opacity: 0;
          }
        }

        .animate-fall-and-fade {
          animation: fall-and-fade forwards;
          animation-timing-function: ease-in;
        }
      `}</style>
    </div>
  );
}
