import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/superadmin", "/workspace", "/settings"],
      },
    ],
    sitemap: "https://talora.vip/sitemap.xml",
  };
}
