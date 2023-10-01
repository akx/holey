import "./styles.css";
import { useControls } from "leva";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const MODES = ["sunflower", "sunflowerGeodesic", "lattice"] as const;
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
  nPerLayer: number;
  twist: number;
}

function roundFloat(val: number, prec: number = 2) {
  return parseFloat(val.toFixed(prec));
}

type PointArray = Array<[number, number]>;

function generateSunflowerPoints(
  n: number,
  alpha: number,
  geodesic: boolean,
  size: number,
): PointArray {
  const phi = (1 + Math.sqrt(5)) / 2;
  const angleStride = geodesic ? 360 * phi : (2 * Math.PI) / phi ** 2;
  const b = Math.round(alpha * Math.sqrt(n));
  const points: PointArray = [];
  for (let k = 1; k <= n; k++) {
    const r = radius(k, n, b) * (size / 2);
    const theta = k * angleStride;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    points.push([roundFloat(x), roundFloat(y)]);
  }
  return points;
}

function generateLatticePoints({
  n,
  size,
  layers,
  nPerLayer,
  twist,
}: {
  n: number;
  size: number;
  layers: number;
  nPerLayer: number;
  twist: number;
}) {
  const points: PointArray = [];
  for (let layer = 0; layer < layers; layer++) {
    const pointsPerLayer = 1 + layer * nPerLayer;
    const angleStride = (2 * Math.PI) / pointsPerLayer;
    const radius = (layer * size) / (2 * layers);
    for (let i = 0; i < pointsPerLayer; i++) {
      const theta = i * angleStride + twist * layer * Math.PI;
      const x = radius * Math.cos(theta);
      const y = radius * Math.sin(theta);
      points.push([roundFloat(x), roundFloat(y)]);
    }
  }
  if (points.length > n) {
    // Evenly remove points until we have the desired number.
    const stride = Math.floor(points.length / n);
    const newPoints: PointArray = [];
    for (let i = 0; i < points.length; i += stride) {
      newPoints.push(points[i]!);
    }
    return newPoints;
  }
  return points;
}

function generatePoints(genProps: GenProps): PointArray {
  switch (genProps.mode) {
    case "sunflower":
    case "sunflowerGeodesic":
      return generateSunflowerPoints(
        genProps.n,
        genProps.alpha,
        genProps.mode === "sunflowerGeodesic",
        genProps.size,
      );
    case "lattice":
      return generateLatticePoints({
        n: genProps.n,
        size: genProps.size,
        layers: genProps.layers,
        nPerLayer: genProps.nPerLayer,
        twist: genProps.twist,
      });
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
  points: PointArray;
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
  points,
  styleProps,
}: SunflowerDotsProps) {
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <g transform={`translate(${size / 2} ${size / 2})`}>
        {points.map(([cx, cy], i) => (
          <Dot key={i} cx={cx} cy={cy} radius={radius} {...styleProps} />
        ))}
      </g>
    </svg>
  );
}

function computePointStats(points: Readonly<PointArray>, size: number) {
  // Compute the minimum distance of each point to any other point.
  const distances = points.map((point, i) => {
    let minDistance = Number.POSITIVE_INFINITY;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const [x, y] = points[j]!;
      const distance = Math.hypot(point[0] - x, point[1] - y) / size;
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    return minDistance;
  });
  // Compute the average and median of the minimum distances.
  const minimum = Math.min(...distances);
  const maximum = Math.max(...distances);
  const average = distances.reduce((a, b) => a + b, 0) / points.length;
  const sorted = [...distances].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const maxDiffFromAverageNorm =
    Math.max(...distances.map((distance) => Math.abs(distance - average))) /
    average;
  return {
    average,
    median,
    minimum,
    maximum,
    maxDiffFromAverageNorm,
  };
}

export default function App() {
  const {
    adjustSizeToFitRadius,
    alpha,
    center,
    crosshair,
    layers,
    mode,
    n,
    radius,
    size,
    svg,
    twist,
    nPerLayer,
  } = useControls({
    mode: {
      options: MODES,
      value: "sunflower",
    },
    n: { value: 50, min: 1, max: 2000, step: 1 },
    alpha: { value: 2, min: 0, max: 3, step: 0.01 },
    layers: { value: 5, min: 1, max: 42, step: 1 },
    nPerLayer: { value: 6, min: 0, max: 20, step: 0.1 },
    size: { value: 500, min: 10, max: 1000, step: 1 },
    radius: { value: 4.5, min: 0, max: 100, step: 0.1 },
    twist: { value: 0, min: 0, max: 0.5, step: 0.01 },
    svg: false,
    center: false,
    crosshair: false,
    adjustSizeToFitRadius: false,
  });
  const genProps: GenProps = {
    n,
    alpha,
    mode: mode as GenMode,
    size,
    layers,
    twist,
    nPerLayer,
  };
  if (adjustSizeToFitRadius) {
    genProps.size -= radius * 2;
  }
  const points = generatePoints(genProps);
  const pointStats = computePointStats(points, size);
  const styleProps = { center, crosshair };
  const comp = (
    <DotArrangement
      size={size}
      points={points}
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
      <pre>{JSON.stringify(pointStats, null, 2)}</pre>
      <br />
      <br />
      <a href="https://stackoverflow.com/a/28572551/51685">
        Sunflower algorithm source
      </a>
    </div>
  );
}
