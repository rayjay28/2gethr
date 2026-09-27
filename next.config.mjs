/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Vercel doesn't reliably deploy dotfiles/dot-folders under /public (like
  // .well-known), so the static Digital Asset Links file 404s in production.
  // Route it to the API handler at app/api/assetlinks/route.ts instead.
  async rewrites() {
    return [
      {
        source: "/.well-known/assetlinks.json",
        destination: "/api/assetlinks",
      },
    ]
  },
}

export default nextConfig
