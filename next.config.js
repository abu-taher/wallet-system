/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix lockfile warning for Vercel deployment
  outputFileTracingRoot: __dirname,
  
  // Ensure better-sqlite3 works in serverless environment  
  serverExternalPackages: ['better-sqlite3'],
  
  // Webpack configuration for better-sqlite3
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('better-sqlite3');
    }
    return config;
  }
};

module.exports = nextConfig;
