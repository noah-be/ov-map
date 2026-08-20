<template>
  <main>
    <section class="intro" aria-labelledby="page-title">
      <p class="eyebrow">Unofficial Overte community project</p>
      <h1 id="page-title">ov-map</h1>
      <p class="summary">A web-based world map for Overte is taking shape here.</p>
    </section>
  </main>
</template>

<style>
:root {
  color: #e7edf3;
  background: #11171d;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
}

main {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 2rem;
  background:
    radial-gradient(circle at 20% 20%, rgb(36 113 135 / 35%), transparent 35%),
    linear-gradient(145deg, #11171d, #17242c);
}

.intro {
  max-width: 44rem;
}

.eyebrow {
  margin: 0 0 0.75rem;
  color: #66d4c0;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(4rem, 15vw, 9rem);
  line-height: 0.9;
  letter-spacing: -0.07em;
}

.summary {
  max-width: 34rem;
  margin: 1.5rem 0 0;
  color: #aebdc8;
  font-size: clamp(1.1rem, 3vw, 1.5rem);
  line-height: 1.5;
}
</style>
