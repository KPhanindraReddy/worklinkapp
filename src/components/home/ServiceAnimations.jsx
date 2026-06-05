import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { recordServiceInteraction } from '../../services/serviceInteractionService';

const SKIN = '#FBBF24';
const SKIN2 = '#F59E0B';
const HAIR = '#1C1917';
const SHIRT_BLUE = '#2563EB';
const PANTS = '#1E3A8A';
const WHITE = '#FFFFFF';

const useTime = (isActive = true) => {
  const [time, setTime] = useState(0);
  const frameRef = useRef();
  const startRef = useRef(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = undefined;
      startRef.current = null;
      return undefined;
    }

    const loop = (timestamp) => {
      if (!startRef.current) {
        startRef.current = timestamp - elapsedRef.current;
      }

      const nextTime = timestamp - startRef.current;
      elapsedRef.current = nextTime;
      setTime(nextTime);
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isActive]);

  return time;
};

const useInView = () => {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(true);

  useEffect(() => {
    const node = ref.current;

    if (!node || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { rootMargin: '120px 0px', threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, isInView];
};

const Head = ({ x, y, look = 0 }) => (
  <g>
    <circle cx={x} cy={y} r="11" fill={SKIN} />
    <circle cx={x - 3 + look} cy={y - 1} r="2" fill={HAIR} />
    <circle cx={x + 3 + look} cy={y - 1} r="2" fill={HAIR} />
    <path d={`M${x - 3} ${y + 4} Q${x} ${y + 7} ${x + 3} ${y + 4}`} stroke={SKIN2} strokeWidth="1.5" fill="none" />
    <ellipse cx={x} cy={y - 8} rx="11" ry="5" fill={HAIR} />
  </g>
);

const SceneLorry = ({ time }) => {
  const cycle = (time * 0.003) % (Math.PI * 2);
  const walkX = Math.sin(cycle) * 6;
  const legSwing = Math.sin(cycle) * 22;
  const bend = Math.sin(cycle * 0.5) * 12;
  const truckX = ((time * 0.035) % 460) - 80;
  const wheelRot = time * 0.18;
  const boxes = [
    { id: 0, phase: 0 },
    { id: 1, phase: 0.4 },
    { id: 2, phase: 0.75 }
  ];

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Lorry loading animation">
      <defs>
        <linearGradient id="lorryRoad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
        <linearGradient id="lorryTruck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="lorryCargo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="lorryBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <filter id="lorryShadow">
          <feDropShadow dx="1" dy="3" stdDeviation="3" floodColor="#00000020" />
        </filter>
        <filter id="lorryGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="380" height="180" fill="#EFF6FF" />
      <ellipse cx={80 + ((time * 0.015) % 400)} cy="28" rx="35" ry="14" fill="white" opacity="0.85" />
      <ellipse cx={90 + ((time * 0.015) % 400)} cy="24" rx="22" ry="12" fill="white" opacity="0.85" />
      <ellipse cx={250 + ((time * 0.01) % 400)} cy="35" rx="28" ry="12" fill="white" opacity="0.7" />

      <rect x="0" y="138" width="380" height="42" fill="url(#lorryRoad)" />
      <rect x="0" y="138" width="380" height="4" fill="#CBD5E1" />
      {[0, 1, 2, 3, 4, 5, 6].map((item) => {
        const dx = ((item * 65) - (time * 0.07) % 65 + 380) % 380;
        return <rect key={item} x={dx} y="157" width="40" height="4" fill="#BFDBFE" rx="2" />;
      })}

      <g filter="url(#lorryShadow)" style={{ transform: `translateX(${truckX}px)` }}>
        <ellipse cx="120" cy="139" rx="100" ry="6" fill="#00000015" />
        <rect x="50" y="95" width="140" height="43" fill="url(#lorryCargo)" rx="3" />
        <rect x="50" y="95" width="140" height="6" fill="#2563EB" rx="2" />
        <text x="120" y="122" textAnchor="middle" fontSize="11" fontWeight="800" fill="#2563EB" fontFamily="system-ui">SLIVZ</text>
        <rect x="12" y="104" width="46" height="34" fill="url(#lorryTruck)" rx="6" />
        <rect x="16" y="108" width="34" height="20" fill="#BFDBFE" rx="3" />
        <circle cx="16" cy="130" r="5" fill="#FEF08A" filter="url(#lorryGlow)" />
        {[35, 105, 158].map((wheelX) => (
          <g key={wheelX} style={{ transform: `rotate(${wheelRot}deg)`, transformOrigin: `${wheelX}px 139px` }}>
            <circle cx={wheelX} cy="139" r="12" fill="#334155" />
            <circle cx={wheelX} cy="139" r="7" fill="#64748B" />
            <circle cx={wheelX} cy="139" r="3.5" fill="#94A3B8" />
          </g>
        ))}
      </g>

      <g style={{ transform: `translateX(${230 + walkX}px)` }}>
        <ellipse cx="0" cy="139" rx="15" ry="4" fill="#00000018" />
        <g style={{ transform: `rotate(${legSwing}deg)`, transformOrigin: '0px 130px' }}>
          <rect x="-7" y="125" width="8" height="18" fill={PANTS} rx="4" />
          <ellipse cx="-3" cy="143" rx="7" ry="3.5" fill="#1E293B" />
        </g>
        <g style={{ transform: `rotate(${-legSwing}deg)`, transformOrigin: '0px 130px' }}>
          <rect x="0" y="125" width="8" height="18" fill={PANTS} rx="4" />
          <ellipse cx="4" cy="143" rx="7" ry="3.5" fill="#1E293B" />
        </g>
        <rect x="-11" y="104" width="22" height="24" fill={SHIRT_BLUE} rx="5" />
        <rect x="-11" y="112" width="22" height="4" fill="#FCD34D" opacity="0.8" />
        <rect x="-11" y="120" width="22" height="3" fill="#FCD34D" opacity="0.8" />
        <text x="0" y="118" textAnchor="middle" fontSize="5" fontWeight="900" fill="#FFFFFF" fontFamily="system-ui">S</text>
        <line x1="-11" y1="110" x2="-22" y2="100" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <line x1="11" y1="110" x2="22" y2="100" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <g style={{ transform: `translateY(${bend * 0.2}px)` }}>
          <rect x="-20" y="84" width="40" height="26" fill="url(#lorryBox)" rx="4" />
          <polygon points="-20,84 -12,76 28,76 20,84" fill="#FDE68A" />
          <polygon points="20,84 28,76 28,102 20,110" fill="#D97706" opacity="0.7" />
          <line x1="0" y1="84" x2="0" y2="110" stroke="#D97706" strokeWidth="1" />
          <line x1="-20" y1="97" x2="20" y2="97" stroke="#D97706" strokeWidth="1" />
        </g>
        <Head x={0} y={94} />
        <ellipse cx="0" cy="84" rx="13" ry="5" fill="#FBBF24" />
        <rect x="-13" y="78" width="26" height="9" fill="#F59E0B" rx="5" />
      </g>

      {boxes.map((box) => {
        const phase = ((time * 0.002 + box.phase) % 1);
        const bx = 230 - phase * 130;
        const by = 90 - Math.sin(phase * Math.PI) * 50 + phase * 10;
        const rotation = phase * 200;
        const opacity = phase < 0.1 ? phase * 10 : phase > 0.88 ? (1 - phase) * 8 : 1;

        return (
          <g key={box.id} style={{ transform: `translate(${bx}px,${by}px) rotate(${rotation}deg)`, opacity }}>
            <rect x="-9" y="-7" width="18" height="14" fill="url(#lorryBox)" rx="2" />
            <line x1="0" y1="-7" x2="0" y2="7" stroke="#D97706" strokeWidth="1" />
            <line x1="-9" y1="0" x2="9" y2="0" stroke="#D97706" strokeWidth="1" />
          </g>
        );
      })}
    </svg>
  );
};

const SceneCatering = ({ time }) => {
  const stir = Math.sin(time * 0.004) * 28;
  const bob = Math.sin(time * 0.003) * 3;
  const steam = [0, 0.35, 0.65];

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Catering animation">
      <defs>
        <radialGradient id="cateringFood" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </radialGradient>
        <linearGradient id="cateringPot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6B7280" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
        <linearGradient id="cateringCounter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
      </defs>

      <rect width="380" height="180" fill="#FFFBF0" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((item) => (
        <rect key={item} x={item * 44 - 2} y="0" width="42" height="55" fill="none" stroke="#FDE68A" strokeWidth="1" opacity="0.5" />
      ))}
      <rect x="0" y="138" width="380" height="42" fill="url(#cateringCounter)" />
      <rect x="0" y="136" width="380" height="6" fill="#CBD5E1" />

      <g style={{ transform: `translateY(${bob}px)` }}>
        <rect x="115" y="104" width="12" height="9" fill="#9CA3AF" rx="3" />
        <rect x="253" y="104" width="12" height="9" fill="#9CA3AF" rx="3" />
        <rect x="128" y="108" width="124" height="30" fill="url(#cateringPot)" rx="4" />
        <rect x="128" y="108" width="124" height="7" fill="#4B5563" rx="4" />
        <ellipse cx="190" cy="112" rx="58" ry="9" fill="url(#cateringFood)" />
        {[170, 185, 200, 215, 195].map((bubbleX, index) => {
          const phase = ((time * 0.003 + index * 0.2) % 1);
          return <circle key={bubbleX} cx={bubbleX} cy={112 - phase * 9} r={2 + phase * 2} fill="#FDE68A" opacity={1 - phase} />;
        })}
        <ellipse cx="190" cy="139" rx="65" ry="6" fill="#00000012" />
        {[-16, -8, 0, 8, 16].map((flameX, index) => {
          const flame = Math.sin(time * 0.008 + index * 1.3) * 4;
          return (
            <g key={flameX}>
              <ellipse cx={190 + flameX} cy={139 + flame} rx="5" ry="9" fill="#FCA5A5" opacity="0.7" />
              <ellipse cx={190 + flameX} cy={141 + flame} rx="3" ry="5" fill="#F97316" opacity="0.9" />
              <ellipse cx={190 + flameX} cy={142 + flame} rx="2" ry="3" fill="#FCD34D" />
            </g>
          );
        })}
      </g>

      {steam.map((phaseStart, index) => {
        const phase = ((time * 0.0015 + phaseStart) % 1);
        return <ellipse key={phaseStart} cx={178 + index * 14} cy={98 - phase * 32} rx={4 + phase * 7} ry={5 + phase * 4} fill="#E2E8F0" opacity={0.5 * (1 - phase)} />;
      })}

      <g style={{ transform: `translateX(258px) translateY(${bob}px)` }}>
        <ellipse cx="0" cy="139" rx="14" ry="4" fill="#00000015" />
        <rect x="-9" y="128" width="8" height="14" fill={PANTS} rx="3" />
        <rect x="2" y="128" width="8" height="14" fill={PANTS} rx="3" />
        <ellipse cx="-5" cy="142" rx="7" ry="3" fill="#0F172A" />
        <ellipse cx="6" cy="142" rx="7" ry="3" fill="#0F172A" />
        <rect x="-12" y="104" width="24" height="26" fill={WHITE} rx="5" />
        <rect x="-12" y="104" width="5" height="26" fill="#F1F5F9" rx="3" />
        <text x="0" y="123" textAnchor="middle" fontSize="5" fontWeight="900" fill="#2563EB" fontFamily="system-ui">SLIVZ</text>
        {[108, 114, 120, 126].map((buttonY) => <circle key={buttonY} cx="0" cy={buttonY} r="1.5" fill="#CBD5E1" />)}
        <rect x="-9" y="112" width="18" height="18" fill="#E0F2FE" rx="2" />
        <g style={{ transform: `rotate(${stir}deg)`, transformOrigin: '-12px 110px' }}>
          <line x1="-12" y1="110" x2="-32" y2="90" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
          <line x1="-32" y1="90" x2="-54" y2="72" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
          <ellipse cx="-57" cy="69" rx="8" ry="6" fill="#D1D5DB" />
          <ellipse cx="-57" cy="68" rx="5" ry="4" fill="#E5E7EB" />
          <ellipse cx="-57" cy="67" rx="4" ry="2.5" fill="#FDE68A" />
        </g>
        <line x1="12" y1="110" x2="22" y2="102" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <Head x={0} y={95} look={-1} />
        <rect x="-10" y="76" width="20" height="11" fill={WHITE} rx="3" />
        <ellipse cx="0" cy="76" rx="11" ry="4.5" fill={WHITE} />
        <ellipse cx="0" cy="72" rx="9" ry="9" fill={WHITE} />
      </g>
    </svg>
  );
};

const SceneHomeRepair = ({ time }) => {
  const hammer = Math.sin(time * 0.006) * 35;
  const spark = Math.max(0, Math.sin(time * 0.006));

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Home repair animation">
      <rect width="380" height="180" fill="#F0F9FF" />
      <rect x="32" y="20" width="316" height="116" fill="#DBEAFE" rx="6" />
      <rect x="32" y="136" width="316" height="44" fill="#D4A574" />
      <rect x="72" y="28" width="86" height="11" fill="#A16207" rx="2" />
      <rect x="112" y="39" width="4" height={12 + spark * 12} fill="#64748B" rx="1" />
      {spark > 0.75 ? (
        <g>
          {[0, 1, 2, 3].map((item) => {
            const angle = (item / 4) * Math.PI * 2;
            return <line key={item} x1="114" y1="42" x2={114 + Math.cos(angle) * 12} y2={42 + Math.sin(angle) * 12} stroke="#FACC15" strokeWidth="2" strokeLinecap="round" />;
          })}
        </g>
      ) : null}
      <g style={{ transform: 'translateX(170px)' }}>
        <ellipse cx="0" cy="140" rx="16" ry="4" fill="#00000015" />
        <rect x="-12" y="122" width="9" height="20" fill={PANTS} rx="3" />
        <rect x="4" y="122" width="9" height="20" fill={PANTS} rx="3" />
        <rect x="-13" y="95" width="26" height="28" fill="#F97316" rx="5" />
        <text x="0" y="112" textAnchor="middle" fontSize="5" fontWeight="900" fill="#FFFFFF" fontFamily="system-ui">SLIVZ</text>
        <g style={{ transform: `rotate(${hammer}deg)`, transformOrigin: '-11px 101px' }}>
          <line x1="-11" y1="101" x2="-39" y2="68" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
          <line x1="-39" y1="68" x2="-54" y2="48" stroke="#92400E" strokeWidth="4" strokeLinecap="round" />
          <rect x="-63" y="42" width="23" height="8" fill="#64748B" rx="2" />
        </g>
        <line x1="13" y1="102" x2="24" y2="112" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <Head x={0} y={89} />
      </g>
    </svg>
  );
};

const SceneElectrician = ({ time }) => {
  const arm = Math.sin(time * 0.005) * 22;
  const spark = Math.max(0, Math.sin(time * 0.012));

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Electrician animation">
      <rect width="380" height="180" fill="#F8FAFC" />
      <rect x="24" y="18" width="332" height="118" fill="#E0F2FE" rx="6" />
      <path d="M82 54 Q150 54 150 88 Q150 118 220 118" stroke="#FACC15" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M82 66 Q150 66 150 98 Q150 130 220 130" stroke="#2563EB" strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="214" y="96" width="36" height="42" fill="#1F2937" rx="4" />
      <rect x="219" y="101" width="26" height="32" fill="#111827" rx="3" />
      {[0, 1, 2].map((item) => <circle key={item} cx="232" cy={108 + item * 9} r="3" fill="#6B7280" />)}
      {spark > 0.7 ? (
        <g>
          {[0, 1, 2, 3, 4].map((item) => {
            const angle = (item / 5) * Math.PI * 2;
            return <line key={item} x1="232" y1="118" x2={232 + Math.cos(angle) * spark * 14} y2={118 + Math.sin(angle) * spark * 14} stroke="#FACC15" strokeWidth="2" strokeLinecap="round" />;
          })}
        </g>
      ) : null}
      <rect x="24" y="136" width="332" height="44" fill="#D1FAE5" />
      <g style={{ transform: 'translateX(295px)' }}>
        <ellipse cx="0" cy="140" rx="14" ry="4" fill="#00000015" />
        <rect x="-9" y="126" width="8" height="16" fill={PANTS} rx="3" />
        <rect x="2" y="126" width="8" height="16" fill={PANTS} rx="3" />
        <rect x="-12" y="100" width="24" height="28" fill="#FCD34D" rx="5" />
        <text x="0" y="117" textAnchor="middle" fontSize="5" fontWeight="900" fill="#1E3A8A" fontFamily="system-ui">SLIVZ</text>
        <g style={{ transform: `rotate(${arm}deg)`, transformOrigin: '-12px 106px' }}>
          <line x1="-12" y1="106" x2="-44" y2="96" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
          <line x1="-44" y1="96" x2="-62" y2="88" stroke="#94A3B8" strokeWidth="3" />
        </g>
        <Head x={0} y={90} look={-2} />
      </g>
    </svg>
  );
};

const ScenePlumber = ({ time }) => {
  const wrench = Math.sin(time * 0.005) * 25;

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Plumbing animation">
      <rect width="380" height="180" fill="#F0F9FF" />
      <rect x="26" y="18" width="328" height="118" fill="#E0F2FE" rx="6" />
      <rect x="62" y="50" width="118" height="80" fill="#CBD5E1" rx="8" />
      <rect x="100" y="20" width="13" height="48" fill="#94A3B8" rx="3" />
      <rect x="132" y="20" width="13" height="48" fill="#94A3B8" rx="3" />
      <circle cx="122" cy="74" r="12" fill="#475569" />
      {[0, 1, 2].map((item) => {
        const drop = ((time * 0.003 + item * 0.33) % 1);
        return <ellipse key={item} cx="122" cy={82 + drop * 28} rx="3" ry={4 + drop * 2} fill="#38BDF8" opacity={1 - drop} />;
      })}
      <rect x="26" y="136" width="328" height="44" fill="#BAE6FD" opacity="0.45" />
      <g style={{ transform: 'translateX(268px) translateY(4px)' }}>
        <ellipse cx="0" cy="140" rx="14" ry="4" fill="#00000015" />
        <rect x="-12" y="118" width="9" height="22" fill={PANTS} rx="3" />
        <rect x="4" y="120" width="9" height="20" fill={PANTS} rx="3" />
        <rect x="-12" y="96" width="24" height="26" fill="#BFDBFE" rx="5" />
        <text x="0" y="112" textAnchor="middle" fontSize="5" fontWeight="900" fill="#1E3A8A" fontFamily="system-ui">SLIVZ</text>
        <g style={{ transform: `rotate(${wrench}deg)`, transformOrigin: '-12px 102px' }}>
          <line x1="-12" y1="102" x2="-38" y2="84" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
          <rect x="-44" y="62" width="7" height="25" fill="#6B7280" rx="3" />
          <path d="M-49 58 Q-40 48 -31 58 L-35 64 L-45 64Z" fill="#4B5563" />
        </g>
        <Head x={0} y={86} look={-2} />
      </g>
    </svg>
  );
};

const SceneCleaning = ({ time }) => {
  const mop = Math.sin(time * 0.004) * 22;
  const bubbles = [0, 1, 2, 3, 4, 5];

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Cleaning animation">
      <rect width="380" height="180" fill="#F0FDF4" />
      <rect x="26" y="18" width="328" height="118" fill="#ECFDF5" rx="6" />
      <rect x="26" y="136" width="328" height="44" fill="#E2E8F0" />
      <ellipse cx="190" cy="148" rx={46 + Math.sin(time * 0.004) * 14} ry="7" fill="#A7F3D0" opacity="0.45" />
      <rect x="60" y="118" width="34" height="31" fill="#FCD34D" rx="4" />
      <ellipse cx="77" cy="118" rx="19" ry="5" fill="#A7F3D0" />
      <g style={{ transform: 'translateX(210px)' }}>
        <ellipse cx="0" cy="140" rx="14" ry="4" fill="#00000015" />
        <rect x="-9" y="125" width="8" height="17" fill={PANTS} rx="3" />
        <rect x="2" y="125" width="8" height="17" fill={PANTS} rx="3" />
        <rect x="-12" y="100" width="24" height="27" fill="#34D399" rx="5" />
        <text x="0" y="117" textAnchor="middle" fontSize="5" fontWeight="900" fill="#064E3B" fontFamily="system-ui">SLIVZ</text>
        <g style={{ transform: `rotate(${mop}deg)`, transformOrigin: '-12px 106px' }}>
          <line x1="-12" y1="106" x2="-30" y2="76" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
          <line x1="-30" y1="76" x2="-52" y2="40" stroke="#92400E" strokeWidth="4" strokeLinecap="round" />
          {[-8, -4, 0, 4, 8].map((item) => <line key={item} x1={-52 + item} y1="40" x2={-52 + item * 1.3} y2="56" stroke="#A7F3D0" strokeWidth="2.5" />)}
        </g>
        <Head x={0} y={90} />
      </g>
      {bubbles.map((item) => {
        const phase = ((time * 0.0018 + item * 0.166) % 1);
        return <circle key={item} cx={96 + item * 38 + Math.sin(time * 0.002 + item) * 10} cy={130 - phase * 82} r="5" fill="none" stroke="#A7F3D0" opacity={1 - phase} />;
      })}
    </svg>
  );
};

const SceneACRepair = ({ time }) => {
  const fan = time * 0.5;
  const screw = time * 0.3;

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="AC repair animation">
      <rect width="380" height="180" fill="#F0F9FF" />
      <rect x="24" y="18" width="332" height="118" fill="#E0F2FE" rx="6" />
      <rect x="50" y="28" width="164" height="76" fill="#F1F5F9" rx="8" />
      <circle cx="100" cy="62" r="19" fill="#CBD5E1" />
      {[0, 1, 2, 3].map((item) => {
        const angle = item * Math.PI / 2 + fan;
        return <ellipse key={item} cx={100 + Math.cos(angle) * 8} cy={62 + Math.sin(angle) * 8} rx="7" ry="3" fill="#94A3B8" />;
      })}
      <rect x="145" y="38" width="58" height="28" fill="#111827" rx="4" />
      <text x="174" y="57" textAnchor="middle" fontSize="13" fill="#34D399" fontFamily="monospace" fontWeight="700">{Math.floor(18 + Math.sin(time * 0.001) * 2)}C</text>
      {[0, 0.33, 0.66].map((start, index) => {
        const phase = ((time * 0.002 + start) % 1);
        return <path key={start} d={`M50 ${86 + index * 8} Q${50 + phase * 60} ${80 + index * 8} ${50 + phase * 120} ${86 + index * 8}`} stroke="#38BDF8" strokeWidth="2" fill="none" opacity={0.6 * (1 - phase)} strokeDasharray="4 3" />;
      })}
      <rect x="24" y="136" width="332" height="44" fill="#BAE6FD" opacity="0.3" />
      <g style={{ transform: 'translateX(305px) translateY(-4px)' }}>
        <ellipse cx="0" cy="145" rx="12" ry="3" fill="#00000015" />
        <rect x="-8" y="126" width="7" height="18" fill={PANTS} rx="3" />
        <rect x="2" y="126" width="7" height="18" fill={PANTS} rx="3" />
        <rect x="-11" y="100" width="22" height="28" fill="#FCD34D" rx="5" />
        <text x="0" y="117" textAnchor="middle" fontSize="5" fontWeight="900" fill="#1E3A8A" fontFamily="system-ui">SLIVZ</text>
        <line x1="-11" y1="106" x2="-42" y2="82" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <g style={{ transform: `rotate(${screw}deg)`, transformOrigin: '-48px 78px' }}>
          <rect x="-56" y="75" width="16" height="6" fill="#F97316" rx="2" />
        </g>
        <Head x={0} y={90} look={-2} />
      </g>
    </svg>
  );
};

const SceneBikePuncture = ({ time }) => {
  const pump = Math.sin(time * 0.006) * 12;
  const wheel = time * 0.08;

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Bike puncture animation">
      <rect width="380" height="180" fill="#FFF7ED" />
      <rect x="0" y="136" width="380" height="44" fill="#FED7AA" />
      <g style={{ transform: `rotate(${wheel}deg)`, transformOrigin: '105px 125px' }}>
        <circle cx="105" cy="125" r="28" fill="none" stroke="#1F2937" strokeWidth="6" />
        {[0, 1, 2, 3, 4, 5].map((item) => {
          const angle = item * Math.PI / 3;
          return <line key={item} x1="105" y1="125" x2={105 + Math.cos(angle) * 26} y2={125 + Math.sin(angle) * 26} stroke="#94A3B8" strokeWidth="2" />;
        })}
      </g>
      <circle cx="205" cy="125" r="28" fill="none" stroke="#1F2937" strokeWidth="6" />
      <path d="M105 125 L150 86 L205 125 M150 86 L175 125 M140 125 L185 125" stroke="#2563EB" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="144" y="72" width="28" height="8" fill="#1F2937" rx="4" />
      <path d="M200 100 Q215 88 230 100" stroke="#EF4444" strokeWidth="3" fill="none" strokeDasharray="5 4" />
      <g style={{ transform: `translateY(${pump}px)` }}>
        <rect x="238" y="82" width="14" height="54" fill="#64748B" rx="4" />
        <rect x="232" y="78" width="26" height="8" fill="#334155" rx="3" />
        <line x1="245" y1="136" x2="218" y2="126" stroke="#64748B" strokeWidth="3" />
      </g>
      <g style={{ transform: 'translateX(282px)' }}>
        <ellipse cx="0" cy="140" rx="14" ry="4" fill="#00000015" />
        <rect x="-9" y="124" width="8" height="18" fill={PANTS} rx="3" />
        <rect x="2" y="124" width="8" height="18" fill={PANTS} rx="3" />
        <rect x="-12" y="98" width="24" height="28" fill="#22C55E" rx="5" />
        <text x="0" y="115" textAnchor="middle" fontSize="5" fontWeight="900" fill="#052E16" fontFamily="system-ui">SLIVZ</text>
        <line x1="-12" y1="105" x2="-34" y2="118" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <line x1="12" y1="105" x2="22" y2="118" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <Head x={0} y={88} look={-2} />
      </g>
    </svg>
  );
};

const SceneGardening = ({ time }) => {
  const push = Math.sin(time * 0.002) * 36;
  const wheel = time * 0.25;
  const leg = Math.sin(time * 0.006) * 18;

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Gardening animation">
      <rect width="380" height="180" fill="#ECFDF5" />
      <circle cx="320" cy="30" r="18" fill="#FDE68A" />
      <ellipse cx={70 + (time * 0.012) % 350} cy="30" rx="30" ry="12" fill="#FFFFFF" opacity="0.8" />
      <ellipse cx="58" cy="88" rx="25" ry="34" fill="#22C55E" />
      <rect x="53" y="108" width="10" height="30" fill="#92400E" />
      <rect x="0" y="120" width="380" height="60" fill="#16A34A" />
      <rect x="0" y="132" width={190 + push} height="18" fill="#86EFAC" />
      {[0, 1, 2, 3, 4, 5].map((item) => {
        const x = 205 + item * 22 + Math.sin(time * 0.004 + item) * 3;
        return <path key={item} d={`M${x} 124 Q${x + 5} 108 ${x + 9} 119`} stroke="#15803D" strokeWidth="3" fill="none" strokeLinecap="round" />;
      })}
      <g style={{ transform: `translateX(${115 + push}px)` }}>
        <rect x="-34" y="112" width="58" height="19" fill="#DC2626" rx="5" />
        <line x1="16" y1="112" x2="40" y2="88" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
        <line x1="-10" y1="88" x2="40" y2="88" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
        {[-20, 16].map((x) => (
          <g key={x} style={{ transform: `rotate(${wheel}deg)`, transformOrigin: `${x}px 132px` }}>
            <circle cx={x} cy="132" r="10" fill="#1F2937" />
            <line x1={x - 6} y1="132" x2={x + 6} y2="132" stroke="#94A3B8" strokeWidth="2" />
            <line x1={x} y1="126" x2={x} y2="138" stroke="#94A3B8" strokeWidth="2" />
          </g>
        ))}
      </g>
      <g style={{ transform: `translateX(${150 + push}px)` }}>
        <g style={{ transform: `rotate(${leg}deg)`, transformOrigin: '0px 130px' }}>
          <rect x="-8" y="124" width="8" height="18" fill={PANTS} rx="3" />
        </g>
        <g style={{ transform: `rotate(${-leg}deg)`, transformOrigin: '0px 130px' }}>
          <rect x="2" y="124" width="8" height="18" fill={PANTS} rx="3" />
        </g>
        <rect x="-12" y="100" width="24" height="26" fill="#16A34A" rx="5" />
        <text x="0" y="117" textAnchor="middle" fontSize="5" fontWeight="900" fill="#FFFFFF" fontFamily="system-ui">SLIVZ</text>
        <line x1="-12" y1="106" x2="-28" y2="91" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <line x1="12" y1="106" x2="26" y2="91" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <Head x={0} y={90} look={-1} />
        <ellipse cx="0" cy="80" rx="15" ry="5" fill="#F59E0B" />
      </g>
    </svg>
  );
};

const SceneBabysitting = ({ time }) => {
  const jump = Math.abs(Math.sin(time * 0.005)) * 10;
  const wave = Math.sin(time * 0.004) * 18;
  const ball = Math.abs(Math.sin(time * 0.006)) * 8;

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Babysitting animation">
      <rect width="380" height="180" fill="#FFF7ED" />
      <rect x="24" y="18" width="332" height="110" fill="#FFEDD5" rx="6" />
      <rect x="24" y="128" width="332" height="52" fill="#FEF3C7" />
      <rect x="275" y="30" width="52" height="42" fill="#BAE6FD" rx="4" />
      <ellipse cx="190" cy="151" rx="105" ry="19" fill="#FBCFE8" opacity="0.7" />
      <circle cx="312" cy={147 - ball} r="11" fill="#EF4444" />
      {[45, 57, 69].map((x, i) => <rect key={x} x={x} y={142 - i * 8} width="13" height="13" fill={['#3B82F6', '#F59E0B', '#10B981'][i]} rx="2" />)}
      <g style={{ transform: `translateX(205px) translateY(${-jump}px)` }}>
        <rect x="-6" y="132" width="5" height="14" fill="#FCA5A5" rx="3" />
        <rect x="1" y="132" width="5" height="14" fill="#FCA5A5" rx="3" />
        <rect x="-10" y="114" width="20" height="20" fill="#F472B6" rx="5" />
        <line x1="-9" y1="118" x2="-22" y2="108" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
        <line x1="9" y1="118" x2="22" y2="108" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
        <circle cx="0" cy="107" r="9" fill={SKIN} />
        <ellipse cx="0" cy="100" rx="10" ry="4" fill={HAIR} />
        <circle cx="-3" cy="106" r="1.5" fill={HAIR} />
        <circle cx="3" cy="106" r="1.5" fill={HAIR} />
      </g>
      <g style={{ transform: 'translateX(145px)' }}>
        <rect x="-9" y="128" width="8" height="18" fill={PANTS} rx="3" />
        <rect x="2" y="128" width="8" height="18" fill={PANTS} rx="3" />
        <rect x="-12" y="104" width="24" height="26" fill="#FDE68A" rx="5" />
        <text x="0" y="121" textAnchor="middle" fontSize="5" fontWeight="900" fill="#92400E" fontFamily="system-ui">SLIVZ</text>
        <g style={{ transform: `rotate(${wave}deg)`, transformOrigin: '12px 110px' }}>
          <line x1="12" y1="110" x2="30" y2="94" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        </g>
        <line x1="-12" y1="110" x2="-28" y2="108" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <Head x={0} y={94} look={1} />
        <circle cx="0" cy="84" r="6" fill={HAIR} />
      </g>
    </svg>
  );
};

const ScenePestControl = ({ time }) => {
  const spray = Math.sin(time * 0.004) * 14;

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Pest control animation">
      <rect width="380" height="180" fill="#F8FAFC" />
      <rect x="24" y="18" width="332" height="112" fill="#F1F5F9" rx="6" />
      <rect x="24" y="130" width="332" height="50" fill="#E2E8F0" />
      {[0, 1, 2, 3, 4, 5].map((item) => {
        const phase = (time * 0.002 + item * 0.17) % 1;
        const x = 54 + phase * 230;
        const y = 128 - Math.sin(phase * Math.PI) * 30;
        return (
          <g key={item} style={{ transform: `translate(${x}px, ${y}px)` }}>
            <ellipse cx="0" cy="0" rx="5" ry="3" fill="#1C1917" />
            <line x1="-4" y1="-2" x2="-8" y2="-5" stroke="#1C1917" />
            <line x1="4" y1="-2" x2="8" y2="-5" stroke="#1C1917" />
          </g>
        );
      })}
      <g style={{ transform: 'translateX(278px)' }}>
        <rect x="-28" y="104" width="13" height="28" fill="#22C55E" rx="5" />
        <rect x="-9" y="124" width="8" height="20" fill={PANTS} rx="3" />
        <rect x="2" y="124" width="8" height="20" fill={PANTS} rx="3" />
        <rect x="-12" y="98" width="24" height="28" fill="#22C55E" rx="5" />
        <text x="0" y="115" textAnchor="middle" fontSize="5" fontWeight="900" fill="#052E16" fontFamily="system-ui">SLIVZ</text>
        <g style={{ transform: `rotate(${spray}deg)`, transformOrigin: '-12px 104px' }}>
          <line x1="-12" y1="104" x2="-48" y2="88" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
          <line x1="-48" y1="88" x2="-70" y2="82" stroke="#64748B" strokeWidth="3" />
          {[0, 1, 2, 3].map((item) => <circle key={item} cx={-82 - item * 13} cy={78 + item * 6} r="3" fill="#A7F3D0" opacity="0.6" />)}
        </g>
        <Head x={0} y={88} look={-2} />
      </g>
    </svg>
  );
};

const SceneCarWash = ({ time }) => {
  const sponge = Math.sin(time * 0.006) * 22;
  const water = time * 0.002;

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Car wash animation">
      <rect width="380" height="180" fill="#E0F2FE" />
      <rect x="0" y="134" width="380" height="46" fill="#BAE6FD" />
      <g>
        <rect x="72" y="90" width="160" height="42" fill="#2563EB" rx="12" />
        <path d="M96 90 L122 62 H182 L212 90Z" fill="#1D4ED8" />
        <rect x="128" y="68" width="48" height="22" fill="#BFDBFE" rx="3" />
        <text x="152" y="118" textAnchor="middle" fontSize="12" fontWeight="900" fill="#FFFFFF" fontFamily="system-ui">SLIVZ</text>
        {[105, 200].map((x) => <circle key={x} cx={x} cy="132" r="14" fill="#1F2937" />)}
      </g>
      {[0, 1, 2, 3, 4].map((item) => {
        const phase = (water + item * 0.2) % 1;
        return <path key={item} d={`M78 ${56 + item * 7} Q${130 + phase * 90} ${38 + item * 8} ${226} ${60 + item * 7}`} stroke="#38BDF8" strokeWidth="3" fill="none" opacity={1 - phase * 0.5} />;
      })}
      <g style={{ transform: 'translateX(282px)' }}>
        <rect x="-9" y="126" width="8" height="18" fill={PANTS} rx="3" />
        <rect x="2" y="126" width="8" height="18" fill={PANTS} rx="3" />
        <rect x="-12" y="100" width="24" height="28" fill="#06B6D4" rx="5" />
        <text x="0" y="117" textAnchor="middle" fontSize="5" fontWeight="900" fill="#083344" fontFamily="system-ui">SLIVZ</text>
        <g style={{ transform: `translateY(${sponge}px)` }}>
          <line x1="-12" y1="106" x2="-42" y2="95" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
          <rect x="-54" y="88" width="18" height="12" fill="#FDE68A" rx="4" />
        </g>
        <Head x={0} y={90} look={-2} />
      </g>
    </svg>
  );
};

const SceneTailoring = ({ time }) => {
  const needle = Math.abs(Math.sin(time * 0.012)) * 10;
  const cloth = Math.sin(time * 0.004) * 8;

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Tailoring animation">
      <rect width="380" height="180" fill="#FAF5FF" />
      <rect x="32" y="124" width="316" height="56" fill="#E9D5FF" />
      <rect x="70" y="92" width="125" height="45" fill="#F8FAFC" rx="6" />
      <path d="M96 92 Q118 64 148 92" stroke="#6B7280" strokeWidth="8" fill="none" strokeLinecap="round" />
      <rect x="125" y={80 + needle} width="5" height="42" fill="#64748B" rx="2" />
      <path d={`M118 129 Q150 ${116 + cloth} 185 129 L185 137 L118 137Z`} fill="#8B5CF6" />
      <rect x="105" y="112" width="58" height="8" fill="#CBD5E1" rx="3" />
      <g style={{ transform: 'translateX(260px)' }}>
        <rect x="-9" y="125" width="8" height="18" fill={PANTS} rx="3" />
        <rect x="2" y="125" width="8" height="18" fill={PANTS} rx="3" />
        <rect x="-12" y="100" width="24" height="27" fill="#8B5CF6" rx="5" />
        <text x="0" y="117" textAnchor="middle" fontSize="5" fontWeight="900" fill="#FFFFFF" fontFamily="system-ui">SLIVZ</text>
        <line x1="-12" y1="106" x2="-42" y2="118" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <line x1="12" y1="106" x2="24" y2="118" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <Head x={0} y={90} look={-2} />
      </g>
    </svg>
  );
};

const SceneLaundry = ({ time }) => {
  const spin = time * 0.18;
  const bubble = time * 0.002;

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Laundry animation">
      <rect width="380" height="180" fill="#F0FDFA" />
      <rect x="42" y="38" width="96" height="104" fill="#CCFBF1" rx="9" />
      <rect x="55" y="52" width="70" height="70" fill="#F8FAFC" rx="35" />
      <g style={{ transform: `rotate(${spin}deg)`, transformOrigin: '90px 87px' }}>
        <path d="M66 87 Q90 62 114 87 Q90 112 66 87Z" fill="#14B8A6" opacity="0.75" />
        <path d="M66 87 Q90 112 114 87 Q90 62 66 87Z" fill="#38BDF8" opacity="0.6" />
      </g>
      <rect x="220" y="44" width="6" height="88" fill="#64748B" />
      <line x1="180" y1="54" x2="285" y2="54" stroke="#64748B" strokeWidth="3" />
      {[190, 225, 260].map((x, i) => <rect key={x} x={x} y="57" width="28" height="34" fill={['#F472B6', '#FDE68A', '#93C5FD'][i]} rx="3" />)}
      {[0, 1, 2, 3, 4].map((item) => {
        const phase = (bubble + item * 0.18) % 1;
        return <circle key={item} cx={80 + item * 34} cy={138 - phase * 82} r={4 + phase * 4} fill="none" stroke="#5EEAD4" opacity={1 - phase} />;
      })}
      <g style={{ transform: 'translateX(308px)' }}>
        <rect x="-9" y="125" width="8" height="18" fill={PANTS} rx="3" />
        <rect x="2" y="125" width="8" height="18" fill={PANTS} rx="3" />
        <rect x="-12" y="100" width="24" height="27" fill="#14B8A6" rx="5" />
        <text x="0" y="117" textAnchor="middle" fontSize="5" fontWeight="900" fill="#042F2E" fontFamily="system-ui">SLIVZ</text>
        <line x1="-12" y1="106" x2="-30" y2="118" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <Head x={0} y={90} />
      </g>
    </svg>
  );
};

const SceneCarpenter = ({ time }) => {
  const saw = Math.sin(time * 0.008) * 18;
  const spark = Math.max(0, Math.sin(time * 0.014));

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Carpentry animation">
      <rect width="380" height="180" fill="#FFF7ED" />
      <rect x="0" y="132" width="380" height="48" fill="#FDBA74" />
      <rect x="62" y="108" width="170" height="22" fill="#92400E" rx="4" />
      <rect x="72" y="130" width="10" height="35" fill="#78350F" />
      <rect x="210" y="130" width="10" height="35" fill="#78350F" />
      {spark > 0.75 ? [0, 1, 2, 3].map((item) => <line key={item} x1="150" y1="105" x2={150 + Math.cos(item * 1.57) * 12} y2={105 + Math.sin(item * 1.57) * 12} stroke="#FACC15" strokeWidth="2" />) : null}
      <g style={{ transform: 'translateX(270px)' }}>
        <rect x="-9" y="124" width="8" height="20" fill={PANTS} rx="3" />
        <rect x="2" y="124" width="8" height="20" fill={PANTS} rx="3" />
        <rect x="-12" y="98" width="24" height="28" fill="#D97706" rx="5" />
        <text x="0" y="115" textAnchor="middle" fontSize="5" fontWeight="900" fill="#FFFFFF" fontFamily="system-ui">SLIVZ</text>
        <g style={{ transform: `translateX(${saw}px)` }}>
          <line x1="-12" y1="104" x2="-45" y2="96" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
          <path d="M-64 88 L-34 96 L-62 104Z" fill="#CBD5E1" stroke="#64748B" strokeWidth="2" />
        </g>
        <Head x={0} y={88} look={-2} />
        <ellipse cx="0" cy="78" rx="13" ry="5" fill="#F59E0B" />
      </g>
    </svg>
  );
};

const SceneMoving = ({ time }) => {
  const carry = Math.sin(time * 0.003) * 12;
  const wheel = time * 0.15;

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Home shifting animation">
      <rect width="380" height="180" fill="#FFF7ED" />
      <rect x="0" y="138" width="380" height="42" fill="#D1D5DB" />
      <rect x="218" y="78" width="105" height="52" fill="#F8FAFC" rx="3" />
      <rect x="218" y="78" width="105" height="8" fill="#F97316" />
      <text x="270" y="110" textAnchor="middle" fontSize="11" fontWeight="900" fill="#F97316" fontFamily="system-ui">SLIVZ</text>
      <rect x="323" y="94" width="38" height="36" fill="#F97316" rx="5" />
      {[240, 312, 344].map((x) => (
        <g key={x} style={{ transform: `rotate(${wheel}deg)`, transformOrigin: `${x}px 132px` }}>
          <circle cx={x} cy="132" r="10" fill="#1F2937" />
          <line x1={x - 5} y1="132" x2={x + 5} y2="132" stroke="#94A3B8" strokeWidth="2" />
        </g>
      ))}
      {[80, 116, 152].map((x, i) => <rect key={x} x={x} y={114 - i * 16} width="34" height="17" fill={['#FCD34D', '#FCA5A5', '#93C5FD'][i]} rx="2" />)}
      <g style={{ transform: `translateX(${115 + carry}px)` }}>
        <rect x="-9" y="124" width="8" height="20" fill={PANTS} rx="3" />
        <rect x="2" y="124" width="8" height="20" fill={PANTS} rx="3" />
        <rect x="-12" y="98" width="24" height="28" fill="#F97316" rx="5" />
        <text x="0" y="115" textAnchor="middle" fontSize="5" fontWeight="900" fill="#FFFFFF" fontFamily="system-ui">SLIVZ</text>
        <line x1="-12" y1="104" x2="-30" y2="92" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <line x1="12" y1="104" x2="30" y2="92" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <Head x={0} y={88} />
      </g>
      <g style={{ transform: `translateX(${175 + carry}px)` }}>
        <rect x="-36" y="84" width="70" height="18" fill="#7C3AED" rx="4" />
        <rect x="-40" y="95" width="80" height="13" fill="#5B21B6" rx="4" />
      </g>
    </svg>
  );
};

const SceneSecurity = ({ time }) => {
  const patrol = Math.sin(time * 0.002) * 48;
  const leg = Math.sin(time * 0.006) * 20;
  const beam = Math.sin(time * 0.003) * 20;

  return (
    <svg viewBox="0 0 380 180" className="block w-full" role="img" aria-label="Security guard animation">
      <defs>
        <radialGradient id="securityBeam" cx="0%" cy="50%" r="100%">
          <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#FEF08A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="380" height="180" fill="#0F172A" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => <circle key={item} cx={35 + item * 42} cy={22 + Math.sin(item) * 9} r="1.5" fill="#FFFFFF" opacity="0.7" />)}
      <rect x="28" y="34" width="130" height="96" fill="#1E293B" />
      {[0, 1, 2, 3].map((x) => [0, 1, 2].map((y) => <rect key={`${x}-${y}`} x={42 + x * 26} y={48 + y * 23} width="14" height="13" fill={Math.sin(time * 0.002 + x + y) > 0 ? '#FDE68A' : '#111827'} rx="1" />))}
      <rect x="0" y="136" width="380" height="44" fill="#1E293B" />
      <g style={{ transform: `translateX(${205 + patrol}px) rotate(${beam}deg)`, transformOrigin: '0px 102px' }}>
        <path d="M0 102 L70 78 L70 126Z" fill="url(#securityBeam)" />
      </g>
      <g style={{ transform: `translateX(${205 + patrol}px)` }}>
        <g style={{ transform: `rotate(${leg}deg)`, transformOrigin: '0px 130px' }}>
          <rect x="-8" y="124" width="8" height="22" fill="#1E3A8A" rx="3" />
        </g>
        <g style={{ transform: `rotate(${-leg}deg)`, transformOrigin: '0px 130px' }}>
          <rect x="2" y="124" width="8" height="22" fill="#1E3A8A" rx="3" />
        </g>
        <rect x="-12" y="98" width="24" height="28" fill="#1E40AF" rx="5" />
        <text x="0" y="115" textAnchor="middle" fontSize="5" fontWeight="900" fill="#FFFFFF" fontFamily="system-ui">SLIVZ</text>
        <g style={{ transform: `rotate(${beam * 0.4}deg)`, transformOrigin: '12px 104px' }}>
          <line x1="12" y1="104" x2="32" y2="96" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
          <rect x="28" y="91" width="14" height="8" fill="#334155" rx="3" />
          <circle cx="43" cy="95" r="4" fill="#FEF08A" />
        </g>
        <line x1="-12" y1="104" x2="-25" y2="100" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <Head x={0} y={88} look={1} />
        <rect x="-13" y="73" width="26" height="9" fill="#1E40AF" rx="4" />
        <ellipse cx="0" cy="78" rx="13" ry="5" fill="#1D4ED8" />
      </g>
    </svg>
  );
};

const scenes = [
  { label: 'Lorry Loading', query: 'Lorry loading', Scene: SceneLorry },
  { label: 'Catering', query: 'Catering', Scene: SceneCatering },
  { label: 'Home Repair', query: 'Home repair', Scene: SceneHomeRepair },
  { label: 'Electrician', query: 'Electrician', Scene: SceneElectrician },
  { label: 'Plumbing', query: 'Plumbing', Scene: ScenePlumber },
  { label: 'Cleaning', query: 'Cleaning', Scene: SceneCleaning },
  { label: 'AC Repair', query: 'AC repair', Scene: SceneACRepair },
  { label: 'Bike Puncture', query: 'Bike puncture', Scene: SceneBikePuncture },
  { label: 'Gardening', query: 'Gardening', Scene: SceneGardening },
  { label: 'Pest Control', query: 'Pest control', Scene: ScenePestControl },
  { label: 'Car Wash', query: 'Car wash', Scene: SceneCarWash },
  { label: 'Tailoring', query: 'Tailoring', Scene: SceneTailoring },
  { label: 'Laundry', query: 'Laundry', Scene: SceneLaundry },
  { label: 'Carpentry', query: 'Carpentry', Scene: SceneCarpenter },
  { label: 'Home Shifting', query: 'Home shifting', Scene: SceneMoving },
  { label: 'Security', query: 'Security guard', Scene: SceneSecurity }
];

export const ServiceAnimations = () => {
  const [containerRef, isInView] = useInView();
  const time = useTime(isInView);

  return (
    <div ref={containerRef} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {scenes.map(({ label, query, Scene }) => (
        <div key={label} className="relative overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
          <img
            src="/slivz-logo-512.png"
            alt="Slivz"
            className="absolute left-2 top-2 z-10 h-8 w-8 rounded-full border border-white/70 bg-slate-950 object-cover shadow-sm"
            loading="lazy"
          />
          <Scene time={time} />
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
            <span className="min-w-0 truncate text-xs font-bold text-slate-950">{label}</span>
            <Link
              to={`/auth?role=client&mode=signup&service=${encodeURIComponent(query)}`}
              className="grid h-7 w-7 flex-none place-items-center rounded-lg border border-brand-200 bg-brand-50 text-brand-700 transition hover:bg-brand-100"
              aria-label={`Register for ${label}`}
              onClick={() =>
                recordServiceInteraction({
                  serviceType: query,
                  type: 'click',
                  source: 'landing_service_animation'
                })
              }
            >
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
};
