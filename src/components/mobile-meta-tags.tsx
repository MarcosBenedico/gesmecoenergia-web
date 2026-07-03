export function MobileMetaTags() {
  return (
    <>
      {/* Meta tags para iOS */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Gesmeco Energía" />
      <meta name="apple-itunes-app" content="app-id=123456789" />

      {/* Icons para iOS */}
      <link rel="apple-touch-icon" href="/icon-180.png" />
      <link rel="icon" type="image/png" sizes="180x180" href="/icon-180.png" />
      <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
      <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />

      {/* Splash screens para iOS */}
      <link
        rel="apple-touch-startup-image"
        href="/splash-1170x2532.png"
        media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
      />
      <link
        rel="apple-touch-startup-image"
        href="/splash-1284x2778.png"
        media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"
      />

      {/* Meta tags para Android */}
      <meta name="theme-color" content="#6366f1" />
      <meta name="mobile-web-app-capable" content="yes" />

      {/* Otros */}
      <meta name="application-name" content="Gesmeco Energía" />
      <meta name="msapplication-TileColor" content="#6366f1" />
      <meta name="msapplication-config" content="/browserconfig.xml" />
    </>
  );
}
