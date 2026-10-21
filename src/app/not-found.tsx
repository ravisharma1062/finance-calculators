import { siteConfig, defaultLocale } from '@config/site';

export default function NotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
        <h1>Page not found</h1>
        <p>We could not find this page.</p>
        <p>
          <a href={`${siteConfig.basePath}/${defaultLocale}/`}>{siteConfig.name}</a>
        </p>
      </body>
    </html>
  );
}
