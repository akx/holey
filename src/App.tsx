import { useControls } from "leva";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// https://oeis.org/A008458
const hexLatticeNumbers = [
  1, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 102, 108,
  114, 120, 126, 132, 138, 144, 150, 156, 162, 168, 174, 180, 186, 192, 198,
  204, 210, 216, 222, 228, 234, 240, 246, 252, 258, 264, 270, 276, 282, 288,
  294, 300, 306, 312, 318, 324, 330, 336, 342, 348,
];

const MODES = ["sunflower", "sunflowerGeodesic", "hexLattice"] as const;
type GenMode = (typeof MODES)[number];

// H/T https://stackoverflow.com/questions/28567166/uniformly-distribute-x-points-inside-a-circle

function radius(k: number, n: number, b: number) {
  if (k > n - b) {
    return 1.0;
  }
  return Math.sqrt(k - 0.5) / Math.sqrt(n - (b + 1) / 2);
}

interface GenProps {
  n: number;
  alpha: number;
  mode: GenMode;
  size: number;
  layers: number;
}

function roundFloat(x: number) {
  return parseFloat(x.toFixed(2));
}

function generateSunflowerPoints(
  n: number,
  alpha: number,
  geodesic: boolean,
  size: number,
): Array<[number, number]> {
  const phi = (1 + Math.sqrt(5)) / 2;
  const angleStride = geodesic ? 360 * phi : (2 * Math.PI) / phi ** 2;
  const b = Math.round(alpha * Math.sqrt(n));
  const points: Array<[number, number]> = [];
  for (let k = 1; k <= n; k++) {
    const r = radius(k, n, b) * (size / 2);
    const theta = k * angleStride;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    points.push([roundFloat(x), roundFloat(y)]);
  }
  return points;
}

function generateHexLatticePoints(n: number, size: number, layers: number) {
  const points: Array<[number, number]> = [];
  // Generate up to `n` evenly distributed points inside a circle,
  // so there are `layers` concentric circles of them
  // with one point always in the middle.
  for (let layer = 0; layer < layers; layer++) {
    const pointsPerLayer = hexLatticeNumbers[layer];
    if (!pointsPerLayer) break;
    const angleStride = (2 * Math.PI) / pointsPerLayer;
    const radius = (layer * size) / (2 * layers);
    for (let i = 0; i < pointsPerLayer; i++) {
      const theta = i * angleStride;
      const x = radius * Math.cos(theta);
      const y = radius * Math.sin(theta);
      points.push([roundFloat(x), roundFloat(y)]);
    }
  }
  return points;
}

function generatePoints(genProps: GenProps) {
  switch (genProps.mode) {
    case "sunflower":
    case "sunflowerGeodesic":
      return generateSunflowerPoints(
        genProps.n,
        genProps.alpha,
        genProps.mode === "sunflowerGeodesic",
        genProps.size,
      );
    case "hexLattice":
      return generateHexLatticePoints(
        genProps.n,
        genProps.size,
        genProps.layers,
      );
    default:
      return [];
  }
}

type DotProps = {
  cx: number;
  cy: number;
  radius: number;
};

type StyleProps = {
  center: boolean;
  crosshair: boolean;
};

interface SunflowerDotsProps {
  radius: number;
  size: number;
  genProps: GenProps;
  styleProps: StyleProps;
}

function Dot({ radius, cx, cy, center, crosshair }: DotProps & StyleProps) {
  const dotStyle = !(center || crosshair)
    ? { fill: "black" }
    : { fill: "none", stroke: "black" };
  const crosshairSize = radius * 0.75;
  return (
    <>
      <circle cx={cx} cy={cy} r={radius} {...dotStyle} />
      {crosshair && (
        <>
          <line
            x1={cx - crosshairSize}
            y1={cy}
            x2={cx + crosshairSize}
            y2={cy}
            stroke="red"
          />
          <line
            x1={cx}
            y1={cy - crosshairSize}
            x2={cx}
            y2={cy + crosshairSize}
            stroke="red"
          />
        </>
      )}
      {center && <circle cx={cx} cy={cy} r={0.1} stroke="blue" />}
    </>
  );
}

function DotArrangement({
  size,
  radius,
  genProps,
  styleProps,
}: SunflowerDotsProps) {
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <g transform={`translate(${size / 2} ${size / 2})`}>
        {generatePoints(genProps).map(([cx, cy], i) => (
          <Dot key={i} cx={cx} cy={cy} radius={radius} {...styleProps} />
        ))}
      </g>
    </svg>
  );
}

export default function App() {
  const {
    n,
    alpha,
    size,
    radius,
    svg,
    center,
    crosshair,
    mode,
    adjustSizeToFitRadius,
    layers,
  } = useControls({
    mode: {
      options: MODES,
      value: "sunflower",
    },
    n: { value: 50, min: 1, max: 1000, step: 1 },
    alpha: { value: 2, min: 0, max: 3, step: 0.01 },
    layers: { value: 5, min: 1, max: hexLatticeNumbers.length, step: 1 },
    size: { value: 500, min: 10, max: 1000, step: 1 },
    radius: { value: 4.5, min: 0, max: 100, step: 0.1 },
    svg: false,
    center: false,
    crosshair: false,
    adjustSizeToFitRadius: false,
  });
  const genProps: GenProps = { n, alpha, mode: mode as GenMode, size, layers };
  if (adjustSizeToFitRadius) {
    genProps.size -= radius * 2;
  }
  const styleProps = { center, crosshair };
  const comp = (
    <DotArrangement
      size={size}
      genProps={genProps}
      radius={radius}
      styleProps={styleProps}
    />
  );
  return (
    <div>
      {svg ? (
        <textarea
          value={renderToStaticMarkup(comp)}
          readOnly
          style={{ width: "100%" }}
          rows={20}
        />
      ) : (
        comp
      )}
      <br />
      <a href="https://stackoverflow.com/a/28572551/51685">
        Sunflower algorithm source
      </a>
    </div>
  );
}
