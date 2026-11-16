import React from "react";

/*
 * Generated animation for the welcome screen (replaces the stock video).
 * Four concentric 24-hour "day rings", each carrying a few event arcs in the category hues.
 * The arcs draw in once (stroke-dashoffset), then each ring drifts by transform: rotate only,
 * at a different slow speed and direction. Pure SVG + CSS: no frames on the main thread.
 */

const C = 500;

// [startHour, endHour, category] per ring: deterministic, read like a plausible week of days.
const RINGS = [
  { r: 248, width: 7, speed: 190, dir: 1, arcs: [[8, 10.5, "study"], [11, 12, "mandatory"], [16, 18, "work"], [19, 20, "health"]] },
  { r: 316, width: 5.5, speed: 260, dir: -1, arcs: [[9, 13.5, "work"], [14, 15, "personal"], [17.5, 19, "study"], [21, 22.5, "personal"]] },
  { r: 384, width: 4.5, speed: 340, dir: 1, arcs: [[7, 8, "health"], [10, 12, "study"], [12.5, 13.5, "mandatory"], [18, 21, "personal"]] },
  { r: 452, width: 3.5, speed: 430, dir: -1, arcs: [[6.5, 9, "work"], [13, 16, "study"], [20, 21, "health"]] },
];

const polar = (r, hour) => {
  const a = (hour / 24) * Math.PI * 2 - Math.PI / 2;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};

const arcD = (r, from, to) => {
  const [x1, y1] = polar(r, from);
  const [x2, y2] = polar(r, to);
  const large = to - from > 12 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

const AuthOrbit = () => (
  <div className="authOrbit" aria-hidden="true">
    <svg viewBox="0 0 1000 1000" className="authOrbitSvg">
      {RINGS.map((ring, ringIndex) => (
        <g
          key={ring.r}
          className="authOrbitRing"
          style={{
            "--orbit-speed": `${ring.speed}s`,
            "--orbit-dir": ring.dir === 1 ? "normal" : "reverse",
          }}
        >
          <circle className="authOrbitTrack" cx={C} cy={C} r={ring.r} />
          {[0, 6, 12, 18].map((hour) => {
            const [x1, y1] = polar(ring.r - ring.width, hour);
            const [x2, y2] = polar(ring.r + ring.width, hour);
            return <line key={hour} className="authOrbitTick" x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
          {ring.arcs.map(([from, to, category], arcIndex) => (
            <path
              key={`${from}-${to}`}
              className="authOrbitArc"
              d={arcD(ring.r, from, to)}
              pathLength="100"
              strokeWidth={ring.width}
              style={{
                stroke: `var(--event-${category}-color)`,
                animationDelay: `${300 + ringIndex * 140 + arcIndex * 70}ms`,
              }}
            />
          ))}
        </g>
      ))}
    </svg>
  </div>
);

export default AuthOrbit;
