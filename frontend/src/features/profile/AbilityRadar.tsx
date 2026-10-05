"use client";

import { useEffect, useState } from "react";
import { profileApi } from "./api";
import type { AbilityRadarResponse } from "./types";

const SIZE = 340;
const CENTER = SIZE / 2;
const RADIUS = 118;
const RINGS = [0.25, 0.5, 0.75, 1];

function pointAt(index: number, total: number, ratio: number): [number, number] {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return [CENTER + Math.cos(angle) * RADIUS * ratio, CENTER + Math.sin(angle) * RADIUS * ratio];
}

function polygonPoints(count: number, ratios: number[]) {
  return ratios
    .map((ratio, index) => pointAt(index, count, ratio).map((v) => v.toFixed(1)).join(","))
    .join(" ");
}

export function AbilityRadar() {
  const [data, setData] = useState<AbilityRadarResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    profileApi
      .abilityRadar()
      .then(setData)
      .catch((nextError: unknown) => {
        setError(nextError instanceof Error ? nextError.message : "能力雷达加载失败");
      });
  }, []);

  const dimensions = data?.dimensions ?? [];
  const hasAnyValue = dimensions.some((item) => item.value !== null);

  return (
    <section className="panel" style={{ padding: "16px" }}>
      <div className="panel-heading">
        <div>
          <p className="section-label">学习诊断</p>
          <h2>能力雷达</h2>
        </div>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {!data && !error ? <p className="chat-status">正在统计答题数据...</p> : null}
      {data ? (
        <>
          {!hasAnyValue ? (
            <p className="chat-status">还没有足够的小测数据，先去做几套小测吧。</p>
          ) : null}
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{ width: "100%", maxWidth: 360, display: "block", margin: "0 auto" }}
            role="img"
            aria-label="能力雷达图"
          >
            {RINGS.map((ring) => (
              <polygon
                key={ring}
                points={polygonPoints(dimensions.length, dimensions.map(() => ring))}
                fill={ring === 1 ? "rgba(47, 111, 97, 0.04)" : "none"}
                stroke="#d8e0e3"
                strokeWidth={1}
              />
            ))}
            {dimensions.map((_, index) => {
              const [x, y] = pointAt(index, dimensions.length, 1);
              return (
                <line
                  key={index}
                  x1={CENTER}
                  y1={CENTER}
                  x2={x}
                  y2={y}
                  stroke="#d8e0e3"
                  strokeWidth={1}
                />
              );
            })}
            <polygon
              points={polygonPoints(
                dimensions.length,
                dimensions.map((item) => (item.value ?? 0) / 100),
              )}
              fill="rgba(47, 111, 97, 0.25)"
              stroke="#2f6f61"
              strokeWidth={2}
            />
            {dimensions.map((item, index) => {
              const [x, y] = pointAt(index, dimensions.length, 1.22);
              return (
                <text
                  key={item.key}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontSize: 12, fill: "#37474f" }}
                >
                  {item.label}
                  {item.value === null ? "" : ` ${Math.round(item.value)}`}
                </text>
              );
            })}
          </svg>
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", fontSize: 13, color: "#546e7a" }}>
            {dimensions.map((item) => (
              <li key={item.key} style={{ marginTop: 4 }}>
                <strong style={{ color: "#37474f" }}>{item.label}</strong>
                {"："}
                {item.value === null ? "暂无数据" : `${Math.round(item.value)} 分`}
                {item.detail ? `（${item.detail}）` : ""}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
