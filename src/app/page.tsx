import { RedirectToLocale } from '@/components/layout/RedirectToLocale';
import { siteConfig, defaultLocale } from '@config/site';

export default function RootPage() {
  const target = `${siteConfig.basePath}/${defaultLocale}/`;
  return (
    <html lang="en">
      <head>
        <title>{siteConfig.name}</title>
        <meta name="robots" content="noindex" />
        <noscript>
          <meta httpEquiv="refresh" content={`0; url=${target}`} />
        </noscript>
      </head>
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <RedirectToLocale basePath={siteConfig.basePath} />
        <p>
          <a href={target}>{siteConfig.name}</a>
        </p>
      </body>
    </html>
  );
}
