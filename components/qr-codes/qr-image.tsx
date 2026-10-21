"use client";

import { useMemo } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

const QUIET_ZONE = 4;
const PNG_SIZE = 1200;

function matrix(text: string) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  return { size: modules.size, data: modules.data };
}

function modulePath(text: string) {
  const { size, data } = matrix(text);
  let path = "";
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (data[y * size + x])
        path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
  return { path, extent: size + QUIET_ZONE * 2 };
}

export function qrSvgMarkup(text: string) {
  const { path, extent } = modulePath(text);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}" shape-rendering="crispEdges"><rect width="${extent}" height="${extent}" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
}

function save(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadSvg(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([qrSvgMarkup(text)], { type: "image/svg+xml" }),
  );
  save(url, `${filename}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadPng(text: string, filename: string) {
  const { size, data } = matrix(text);
  const extent = size + QUIET_ZONE * 2;
  const scale = Math.ceil(PNG_SIZE / extent);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = extent * scale;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000";
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (data[y * size + x])
        context.fillRect(
          (x + QUIET_ZONE) * scale,
          (y + QUIET_ZONE) * scale,
          scale,
          scale,
        );
  save(canvas.toDataURL("image/png"), `${filename}.png`);
}

export default function QrImage({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const { path, extent } = useMemo(() => modulePath(text), [text]);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${extent} ${extent}`}
      shapeRendering="crispEdges"
      className={cn("block aspect-square rounded-md", className)}
    >
      <rect width={extent} height={extent} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
