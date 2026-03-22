import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const TopProgressBar: React.FC = () => {
  const location = useLocation();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any ongoing animation
    if (timerRef.current) clearTimeout(timerRef.current);

    // Start animation on route change
    const t0 = setTimeout(() => {
      setVisible(true);
      setWidth(0);
    }, 0);

    const t1 = setTimeout(() => setWidth(80), 10);
    const t2 = setTimeout(() => setWidth(100), 300);
    const t3 = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 600);

    timerRef.current = t3;
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[500] h-0.5 bg-transparent pointer-events-none">
      <div
        className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] transition-all ease-out"
        style={{
          width: `${width}%`,
          transitionDuration: width === 100 ? '200ms' : '400ms',
        }}
      />
    </div>
  );
};

export default TopProgressBar;
