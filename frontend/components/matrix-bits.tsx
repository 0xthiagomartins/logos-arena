import type { CSSProperties } from "react";

type MatrixStream = {
  x: string;
  y: string;
  delay: string;
  duration: string;
  content: string;
};

function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeBinaryChain(rand: () => number): string {
  const lines = 3 + Math.floor(rand() * 8); // 3..10
  const out: string[] = [];
  for (let i = 0; i < lines; i += 1) {
    const digits = 1 + Math.floor(rand() * 4); // 1..4
    let line = "";
    for (let d = 0; d < digits; d += 1) {
      line += rand() > 0.5 ? "1" : "0";
    }
    out.push(line);
  }
  return out.join("\n");
}

const STREAM_COUNT = 20;
const STREAMS: MatrixStream[] = Array.from({ length: STREAM_COUNT }).map((_, index) => {
  const rand = prng(8917 + index * 131);
  return {
    x: `${3 + Math.floor(rand() * 94)}%`,
    y: `${6 + Math.floor(rand() * 78)}%`,
    delay: `${-(rand() * 16).toFixed(2)}s`,
    duration: `${8 + Math.floor(rand() * 9)}s`,
    content: makeBinaryChain(rand),
  };
});

export default function MatrixBits() {
  return (
    <div className="matrix-bits" aria-hidden="true">
      {STREAMS.map((stream, index) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={`${stream.x}-${index}`}
          className="matrix-stream"
          style={
            {
              "--stream-x": stream.x,
              "--stream-y": stream.y,
              "--stream-delay": stream.delay,
              "--stream-duration": stream.duration,
            } as CSSProperties
          }
        >
          {stream.content}
        </span>
      ))}
    </div>
  );
}
