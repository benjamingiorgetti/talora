import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Talora - Turnos automaticos por WhatsApp con IA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #18181B 0%, #111318 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "80px",
            height: "80px",
            borderRadius: "20px",
            backgroundColor: "rgba(255,255,255,0.1)",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              fontSize: "40px",
              fontWeight: 700,
              color: "white",
            }}
          >
            T
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: "56px",
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: "16px",
          }}
        >
          Talora
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "28px",
            color: "rgba(255,255,255,0.6)",
            textAlign: "center",
            lineHeight: 1.4,
            maxWidth: "800px",
          }}
        >
          Turnos automaticos por WhatsApp con IA
        </div>

        {/* Accent line */}
        <div
          style={{
            width: "120px",
            height: "4px",
            borderRadius: "2px",
            backgroundColor: "#C6F6D5",
            marginTop: "32px",
          }}
        />

        {/* Domain */}
        <div
          style={{
            fontSize: "20px",
            color: "rgba(255,255,255,0.35)",
            marginTop: "24px",
          }}
        >
          talora.vip
        </div>
      </div>
    ),
    { ...size }
  );
}
