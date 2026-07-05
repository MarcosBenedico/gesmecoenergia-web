/**
 * Librería de efectos 3D y animaciones interactivas
 */

export const tilt3D = (element: HTMLElement, sensitivity = 15) => {
  const handler = (e: MouseEvent) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / sensitivity;
    const rotateY = -(x - centerX) / sensitivity;

    element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  };

  const resetHandler = () => {
    element.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
  };

  element.addEventListener('mousemove', handler);
  element.addEventListener('mouseleave', resetHandler);

  return () => {
    element.removeEventListener('mousemove', handler);
    element.removeEventListener('mouseleave', resetHandler);
  };
};

export const parallaxScroll = (element: HTMLElement, speed = 0.5) => {
  const handler = () => {
    const rect = element.getBoundingClientRect();
    const scrollY = window.scrollY;
    const elementY = rect.top + scrollY;
    const offset = (scrollY - elementY) * speed;
    element.style.transform = `translateY(${offset}px)`;
  };

  window.addEventListener('scroll', handler);
  return () => window.removeEventListener('scroll', handler);
};

export const glowOnHover = (element: HTMLElement, color = '#6366f1') => {
  element.style.transition = 'all 0.3s ease';

  element.addEventListener('mouseenter', () => {
    element.style.boxShadow = `0 0 20px ${color}, 0 0 40px ${color}40`;
    element.style.borderColor = color;
  });

  element.addEventListener('mouseleave', () => {
    element.style.boxShadow = 'none';
    element.style.borderColor = '';
  });
};

export const mouseFollowGlow = (element: HTMLElement, color = '#6366f1') => {
  const glow = document.createElement('div');
  glow.style.cssText = `
    position: fixed;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(circle, ${color}30 0%, transparent 70%);
    filter: blur(40px);
    z-index: -1;
  `;
  document.body.appendChild(glow);

  const handler = (e: MouseEvent) => {
    glow.style.left = (e.clientX - 150) + 'px';
    glow.style.top = (e.clientY - 150) + 'px';
  };

  document.addEventListener('mousemove', handler);
  return () => {
    document.removeEventListener('mousemove', handler);
    glow.remove();
  };
};

export const animateOnScroll = (element: HTMLElement, animation: string) => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        element.style.animation = animation;
        observer.unobserve(element);
      }
    });
  }, { threshold: 0.1 });

  observer.observe(element);
  return () => observer.disconnect();
};
