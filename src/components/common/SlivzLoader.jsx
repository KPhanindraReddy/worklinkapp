import { useEffect, useRef } from 'react';

export const SlivzLoader = ({ label = 'Connecting to worker' }) => {
  const boxRef = useRef(null);
  const barRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    const durationMs = 2200;
    let start = null;
    let lastBucket = -1;
    let bobUp = false;
    let animationFrame;

    const ease = (value) =>
      value < 0.5 ? 2 * value * value : -1 + (4 - 2 * value) * value;

    const tick = (timestamp) => {
      if (!boxRef.current || !barRef.current || !trackRef.current) {
        animationFrame = requestAnimationFrame(tick);
        return;
      }

      if (!start) {
        start = timestamp;
      }

      const raw = ((timestamp - start) % durationMs) / durationMs;
      const progress = ease(raw);
      const maxX = Math.max(0, trackRef.current.offsetWidth - 70);
      const bucket = Math.floor(progress * 7);

      boxRef.current.style.left = `${progress * maxX}px`;
      barRef.current.style.width = `${progress * 100}%`;

      if (bucket !== lastBucket) {
        lastBucket = bucket;
        bobUp = !bobUp;
        boxRef.current.style.transition = 'bottom 0.1s ease-out';
        boxRef.current.style.bottom = bobUp ? '16px' : '6px';
      }

      if (raw > 0.98) {
        start = null;
        lastBucket = -1;
        bobUp = false;
      }

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div className="w-full bg-white px-0 pb-5 pt-6">
      <div ref={trackRef} className="relative h-[68px]">
        <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-sm bg-slate-100" />
        <div ref={barRef} className="absolute bottom-0 left-0 h-[3px] w-0 rounded-sm bg-slate-950" />

        <div ref={boxRef} className="absolute bottom-[6px] left-0">
          <svg width="70" height="50" viewBox="0 0 70 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <linearGradient id="slivz-loader-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>

            <rect x="1" y="18" width="68" height="30" fill="#0B1120" rx="6" />
            <rect x="1" y="18" width="68" height="11" fill="#111827" rx="6" />
            <rect x="1" y="25" width="68" height="4" fill="#111827" />
            <rect x="1" y="28" width="68" height="2" fill="url(#slivz-loader-gradient)" opacity="0.85" />
            <path
              d="M24 10 Q24 3 35 3 Q46 3 46 10 L46 18 L42 18 L42 11 Q42 7 35 7 Q28 7 28 11 L28 18 L24 18 Z"
              fill="#111827"
            />
            <rect x="29" y="34" width="12" height="10" fill="#1E3A8A" rx="2.5" />
            <rect x="31" y="36" width="8" height="6" fill="#0B1120" rx="1.5" />
            <text
              x="35"
              y="26"
              textAnchor="middle"
              fontSize="10"
              fontWeight="900"
              fill="white"
              fontFamily="DM Sans, system-ui"
            >
              Sliv
              <tspan fill="url(#slivz-loader-gradient)">z</tspan>
            </text>
          </svg>
        </div>
      </div>

      <p className="mt-4 text-center text-sm font-bold text-slate-800">{label}</p>
    </div>
  );
};
