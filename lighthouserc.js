module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/'],
      startServerCommand: 'npm start',
      startServerReadyPattern: 'listening on port',
      startServerReadyTimeout: 30000, // allow up to 30 s for npm start to be ready in CI
      numberOfRuns: 2,
      settings: {
        chromeFlags: '--no-sandbox --disable-gpu',
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.6 }],
        'categories:accessibility': ['error', { minScore: 0.8 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.7 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 3000 }],
        interactive: ['warn', { maxNumericValue: 6000 }],
        'total-blocking-time': ['warn', { maxNumericValue: 500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
