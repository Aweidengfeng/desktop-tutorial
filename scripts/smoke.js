#!/usr/bin/env node
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function smoke() {
  const steps = [
    { name: 'health check', fn: async () => {
      const r = await fetch(`${BASE_URL}/api/health`);
      if (!r.ok) throw new Error(`health failed: ${r.status}`);
    }},
    { name: 'peaks list', fn: async () => {
      const r = await fetch(`${BASE_URL}/api/peaks?category=eight_thousanders`);
      if (!r.ok) throw new Error(`peaks failed: ${r.status}`);
    }},
    { name: 'weather popular peaks', fn: async () => {
      const r = await fetch(`${BASE_URL}/api/weather/popular-peaks`);
      if (!r.ok && r.status !== 503) throw new Error(`weather failed: ${r.status}`);
    }},
    { name: 'homepage HTML', fn: async () => {
      const r = await fetch(`${BASE_URL}/summitlink`);
      if (!r.ok) throw new Error(`homepage failed: ${r.status}`);
    }},
    { name: 'legal privacy page', fn: async () => {
      const r = await fetch(`${BASE_URL}/legal/privacy`);
      if (!r.ok) throw new Error(`legal/privacy failed: ${r.status}`);
    }},
  ];

  let allPassed = true;
  for (const step of steps) {
    try {
      await step.fn();
      console.log(`  ✅ ${step.name}`);
    } catch(e) {
      console.error(`  ❌ ${step.name}: ${e.message}`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\n✅ SMOKE PASSED');
    process.exit(0);
  } else {
    console.log('\n❌ SMOKE FAILED');
    process.exit(1);
  }
}

smoke().catch(e => { console.error(e); process.exit(1); });
