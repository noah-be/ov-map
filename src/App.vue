<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import WorldMap from './components/WorldMap.vue'
import { useWorldStore } from './stores/world'

const store = useWorldStore()
const map = ref<InstanceType<typeof WorldMap> | null>(null)
const address = ref('')
const sortedTypes = computed(() =>
  Object.entries(store.world?.types ?? {}).sort((left, right) => right[1] - left[1]),
)

onMounted(() => store.initialize())

async function connectToWorld(): Promise<void> {
  await store.connect(address.value)
}
</script>

<template>
  <main>
    <header>
      <div>
        <p class="eyebrow">Unofficial Overte community project</p>
        <h1>ov-map</h1>
      </div>
      <div v-if="store.world" class="world-status">
        <strong>{{ store.world.entityCount.toLocaleString() }}</strong>
        <span>entities · export v{{ store.world.version ?? 'unknown' }}</span>
      </div>
    </header>

    <form class="connect" @submit.prevent="connectToWorld">
      <label for="world-address">Online world</label>
      <div>
        <input
          id="world-address"
          v-model="address"
          autocomplete="off"
          placeholder="Place name or hifi:// address"
          :disabled="store.connection.state === 'connecting'"
        />
        <button
          type="submit"
          :disabled="store.connection.state === 'connecting' || !address.trim()"
        >
          {{ store.connection.state === 'connecting' ? 'Scanning…' : 'Connect' }}
        </button>
      </div>
      <small v-if="store.connection.state !== 'idle'">{{ store.connection.message }}</small>
    </form>

    <section v-if="store.loading" class="notice">Loading world data…</section>
    <section v-else-if="store.error" class="notice error" role="alert">
      <strong>World data could not be loaded.</strong>
      <span>{{ store.error }}</span>
      <button type="button" @click="store.load">Try again</button>
    </section>

    <div v-else-if="store.world" class="workspace">
      <aside class="controls">
        <label class="search">
          <span>Find an entity</span>
          <input v-model="store.search" type="search" placeholder="Name or type" />
        </label>

        <section class="filters" aria-labelledby="filter-title">
          <div class="section-heading">
            <h2 id="filter-title">Layers</h2>
            <button type="button" @click="store.hiddenTypes.clear()">Show all</button>
          </div>
          <label v-for="[type, count] in sortedTypes" :key="type">
            <input
              type="checkbox"
              :checked="!store.hiddenTypes.has(type)"
              @change="store.toggleType(type)"
            />
            <span>{{ type }}</span>
            <small>{{ count }}</small>
          </label>
        </section>

        <section v-if="store.selectedEntity" class="details" aria-labelledby="details-title">
          <div class="section-heading">
            <h2 id="details-title">{{ store.selectedEntity.name }}</h2>
            <button type="button" aria-label="Close details" @click="store.select(null)">×</button>
          </div>
          <p v-if="store.selectedEntity.description">{{ store.selectedEntity.description }}</p>
          <dl>
            <dt>Type</dt>
            <dd>{{ store.selectedEntity.type }}</dd>
            <dt>Position</dt>
            <dd>
              {{ store.selectedEntity.position.x.toFixed(1) }},
              {{ store.selectedEntity.position.y.toFixed(1) }},
              {{ store.selectedEntity.position.z.toFixed(1) }}
            </dd>
            <dt>Size</dt>
            <dd>
              {{ store.selectedEntity.dimensions.x.toFixed(1) }} ×
              {{ store.selectedEntity.dimensions.y.toFixed(1) }} ×
              {{ store.selectedEntity.dimensions.z.toFixed(1) }} m
            </dd>
          </dl>
          <a
            v-if="store.selectedEntity.modelUrl"
            :href="store.selectedEntity.modelUrl"
            target="_blank"
            rel="noopener noreferrer"
            >Open model asset</a
          >
          <code>{{ store.selectedEntity.id }}</code>
        </section>

        <footer>
          <span>Source refreshed {{ new Date(store.world.loadedAt).toLocaleTimeString() }}</span>
          <button type="button" @click="store.load">Refresh</button>
        </footer>
      </aside>

      <WorldMap
        ref="map"
          :entities="store.visibleEntities"
          :avatars="store.world?.avatars ?? []"
        :bounds="store.world.bounds"
        :selected-id="store.selectedId"
        @select="store.select"
      />
    </div>
  </main>
</template>

<style>
:root {
  color: #e9f0f3;
  background: #0b1216;
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
button,
input {
  font: inherit;
}
button:focus-visible,
input:focus-visible,
canvas:focus-visible {
  outline: 2px solid #73d9c7;
  outline-offset: 2px;
}

main {
  min-height: 100vh;
  padding: clamp(1rem, 3vw, 2.5rem);
  background: radial-gradient(circle at 15% 0%, rgb(31 100 117 / 24%), transparent 30%);
}
header {
  display: flex;
  max-width: 100rem;
  margin: 0 auto 1.25rem;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}
.connect {
  display: grid;
  max-width: 100rem;
  margin: 0 auto 1rem;
  gap: 0.4rem;
}
.connect > label {
  color: #9db0b9;
  font-size: 0.75rem;
  font-weight: 650;
}
.connect > div {
  display: flex;
  gap: 0.5rem;
}
.connect input {
  flex: 1;
  min-width: 0;
  padding: 0.7rem 0.8rem;
  border: 1px solid #304752;
  border-radius: 0.45rem;
  color: #ecf4f6;
  background: #0a1419;
}
.connect button {
  padding: 0.7rem 1rem;
  border: 0;
  border-radius: 0.45rem;
  color: #092019;
  background: #66d4c0;
  cursor: pointer;
  font-weight: 750;
}
.connect button:disabled {
  cursor: wait;
  opacity: 0.55;
}
.connect small {
  color: #7f969f;
}
.eyebrow {
  margin: 0 0 0.35rem;
  color: #66d4c0;
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-size: clamp(2.3rem, 6vw, 4rem);
  line-height: 0.9;
  letter-spacing: -0.06em;
}
.world-status {
  display: grid;
  text-align: right;
  color: #94aab5;
  font-size: 0.78rem;
}
.world-status strong {
  color: #edf5f7;
  font-size: 1.4rem;
}
.workspace {
  display: grid;
  grid-template-columns: minmax(15rem, 20rem) minmax(0, 1fr);
  max-width: 100rem;
  min-height: calc(100vh - 9rem);
  margin: auto;
  overflow: hidden;
  border: 1px solid #283c47;
  border-radius: 0.9rem;
  box-shadow: 0 1.5rem 5rem rgb(0 0 0 / 32%);
}
.controls {
  display: flex;
  flex-direction: column;
  min-height: 30rem;
  padding: 1.15rem;
  border-right: 1px solid #283c47;
  background: #111c22;
}
.search {
  display: grid;
  gap: 0.45rem;
  color: #9db0b9;
  font-size: 0.75rem;
  font-weight: 650;
}
.search input {
  width: 100%;
  padding: 0.7rem 0.8rem;
  border: 1px solid #304752;
  border-radius: 0.45rem;
  color: #ecf4f6;
  background: #0a1419;
}
.filters,
.details {
  margin-top: 1.4rem;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
h2 {
  margin: 0;
  font-size: 0.95rem;
}
.section-heading button,
footer button {
  padding: 0;
  border: 0;
  color: #73d9c7;
  background: transparent;
  cursor: pointer;
  font-size: 0.75rem;
}
.filters label {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.42rem 0;
  color: #c5d2d8;
  font-size: 0.82rem;
}
.filters input {
  accent-color: #66d4c0;
}
.filters small {
  color: #738a95;
}
.details {
  padding-top: 1rem;
  border-top: 1px solid #263943;
}
.details p {
  color: #a9bac2;
  font-size: 0.82rem;
  line-height: 1.5;
}
.details dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 0.7rem;
  font-size: 0.75rem;
}
.details dt {
  color: #738a95;
}
.details dd {
  margin: 0;
  color: #cbd7dc;
}
.details a {
  display: block;
  margin: 0.8rem 0;
  color: #73d9c7;
  font-size: 0.78rem;
}
.details code {
  display: block;
  overflow: hidden;
  color: #6f8791;
  font-size: 0.65rem;
  text-overflow: ellipsis;
}
footer {
  display: flex;
  margin-top: auto;
  padding-top: 1rem;
  justify-content: space-between;
  gap: 0.5rem;
  color: #6f8791;
  font-size: 0.67rem;
}
.notice {
  display: grid;
  max-width: 42rem;
  margin: 10vh auto;
  gap: 0.7rem;
  padding: 1.5rem;
  border: 1px solid #304752;
  border-radius: 0.7rem;
  background: #111c22;
}
.notice.error {
  border-color: #75454b;
}
.notice button {
  width: max-content;
  padding: 0.5rem 0.7rem;
  border: 0;
  border-radius: 0.4rem;
  background: #66d4c0;
  cursor: pointer;
}

@media (max-width: 720px) {
  header {
    align-items: start;
  }
  .workspace {
    grid-template-columns: 1fr;
  }
  .controls {
    min-height: auto;
    border-right: 0;
    border-bottom: 1px solid #283c47;
  }
  .filters {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
  .filters .section-heading {
    grid-column: 1 / -1;
  }
}
</style>
