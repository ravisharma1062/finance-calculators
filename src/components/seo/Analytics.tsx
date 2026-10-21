import { siteConfig } from '@config/site';

/** Plausible analytics. Off unless NEXT_PUBLIC_ANALYTICS_DOMAIN is set at build time. */
export function Analytics() {
  if (!siteConfig.analyticsDomain) return null;
  return <script defer data-domain={siteConfig.analyticsDomain} src="https://plausible.io/js/script.js" />;
}
