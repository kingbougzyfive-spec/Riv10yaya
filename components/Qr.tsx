"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function useQr(value: string, size = 512) {
  const [url, setUrl] = useState("");
  useEffect(() => { let off = false; QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0b1220", light: "#ffffff" } }).then((u) => !off && setUrl(u)).catch(() => {}); return () => { off = true; }; }, [value, size]);
  return url;
}

export function QrCode({ value, size = 220, className = "" }: { value: string; size?: number; className?: string }) {
  const url = useQr(value, Math.max(size * 2, 400));
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="QR code" width={size} height={size} className={`rounded-2xl bg-white p-2 ${className}`} /> : <div className="skeleton" style={{ width: size, height: size }} />;
}
