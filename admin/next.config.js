/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  i18n: {
    locales: ['ar', 'tr', 'en'],
    defaultLocale: 'ar',
    localeDetection: true,
  },
};

module.exports = nextConfig;
