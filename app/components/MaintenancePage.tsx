export function MaintenancePage({ appName }: { appName: string }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{appName} - We'll be back soon</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #fafafa;
                color: #1a1a1a;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 1rem;
              }
              .container {
                text-align: center;
                max-width: 480px;
              }
              .logo {
                font-size: 2.5rem;
                font-weight: 700;
                margin-bottom: 2rem;
                color: #111;
              }
              .icon {
                font-size: 4rem;
                margin-bottom: 1.5rem;
              }
              h1 {
                font-size: 1.5rem;
                font-weight: 600;
                margin-bottom: 0.75rem;
              }
              p {
                color: #666;
                line-height: 1.6;
                font-size: 1rem;
              }
              .divider {
                width: 60px;
                height: 3px;
                background: #111;
                margin: 1.5rem auto;
                border-radius: 2px;
              }
            `,
          }}
        />
      </head>
      <body>
        <div className="container">
          <div className="logo" style={{ fontFamily: "'Dancing Script', cursive" }}>
            {appName}
          </div>
          <div className="icon">🔧</div>
          <h1>We'll be back soon</h1>
          <div className="divider" />
          <p>
            We're performing scheduled maintenance to improve your experience. Please check back
            shortly.
          </p>
        </div>
      </body>
    </html>
  );
}
