import { type FC, useEffect, useRef } from 'react';

const GOOGLE_COLORS = [
  '#4285F4', // Blue
  '#EA4335', // Red
  '#FBBC05', // Yellow/Orange
  '#34A853', // Green
  '#7C3AED', // Indigo/Purple
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  color: string;
  alpha: number;
  decay: number;
}

export const GravityCanvas: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const particles: Particle[] = [];

    // Spawn particles on mouse move
    const handleMouseMove = (e: MouseEvent) => {
      // Spawn 3 particles per mouse move event for a rich trail
      for (let i = 0; i < 3; i++) {
        // Random angle and speed for burst distribution
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2.5 + 0.5;

        particles.push({
          x: e.clientX,
          y: e.clientY,
          // Burst outwards from cursor
          vx: Math.cos(angle) * speed,
          // Upward drift bias (anti-gravity liftoff)
          vy: Math.sin(angle) * speed - 1.2,
          length: Math.random() * 4 + 6, // 6px to 10px dashes
          color: GOOGLE_COLORS[Math.floor(Math.random() * GOOGLE_COLORS.length)],
          alpha: 1.0,
          decay: Math.random() * 0.015 + 0.012, // Lives for ~40-80 frames
        });
      }
    };

    // Support touch devices
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 0.5;
        particles.push({
          x: touch.clientX,
          y: touch.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.0,
          length: Math.random() * 4 + 5,
          color: GOOGLE_COLORS[Math.floor(Math.random() * GOOGLE_COLORS.length)],
          alpha: 1.0,
          decay: Math.random() * 0.018 + 0.015,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw and update particles in reverse loop so we can safe-delete
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // 1. Update physics
        p.vx *= 0.97; // Friction
        p.vy *= 0.97;

        // Anti-gravity float upward acceleration
        p.vy -= 0.05;

        p.x += p.vx;
        p.y += p.vy;

        // Fade out
        p.alpha -= p.decay;

        // Delete if faded
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        // 2. Draw dash
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        let dirX = 0;
        let dirY = -1; // Default upward drift direction

        if (speed > 0.1) {
          dirX = p.vx / speed;
          dirY = p.vy / speed;
        }

        const currentLength = p.length + speed * 1.5;

        ctx.beginPath();
        ctx.moveTo(p.x - (dirX * currentLength) / 2, p.y - (dirY * currentLength) / 2);
        ctx.lineTo(p.x + (dirX * currentLength) / 2, p.y + (dirY * currentLength) / 2);
        
        // Render with particle's alpha
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Reset globalAlpha to default
      ctx.globalAlpha = 1.0;

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
};
