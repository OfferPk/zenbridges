# ZenBridges 🌉

[![CI](https://github.com/OfferPk/zenbridges/actions/workflows/ci.yml/badge.svg)](https://github.com/OfferPk/zenbridges/actions/workflows/ci.yml)
[![Pages](https://github.com/OfferPk/zenbridges/actions/workflows/pages.yml/badge.svg)](https://github.com/OfferPk/zenbridges/actions/workflows/pages.yml)
[![Android](https://github.com/OfferPk/zenbridges/actions/workflows/android.yml/badge.svg)](https://github.com/OfferPk/zenbridges/actions/workflows/android.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> A sleek, calming offline Hashiwokakero (Bridges) island connection logic puzzle game. Connect glowing tranquil island stones across a serene water grid with single and double radiant bridges so that each island reaches its exact required bridge count and all islands form a single continuous connected network.

---

## 🎮 Play Live

- **Web Demo (GitHub Pages)**: [https://offerpk.github.io/zenbridges/](https://offerpk.github.io/zenbridges/)
- **Android APK**: Download `zenbridges-debug.apk` from the latest [Android build GitHub Actions run](https://github.com/OfferPk/zenbridges/actions/workflows/android.yml) or Releases.

---

## ✨ Features

- **50 Solver-Verified Puzzle Levels**: Handcrafted progression across 5 distinct thematic packs:
  1. *Archipelago* (Levels 1–10, 5x5 grids, relaxing intro)
  2. *Serene Waters* (Levels 11–20, 6x6 grids, intersection puzzles)
  3. *Coral Reef* (Levels 21–30, 7x7 grids, multi-bridge networks)
  4. *Mystic Atolls* (Levels 31–40, 8x8 grids, deep deductive logic)
  5. *Celestial Ocean* (Levels 41–50, 9x9 grids, master puzzles)
- **Authentic Hashiwokakero Engine**:
  - Orthogonal horizontal and vertical connections between direct visible neighbors.
  - Strict non-intersecting bridge rules.
  - At most 2 bridges per connection pair (0 → 1 → 2 → 0).
  - Graph BFS connectivity verification ensuring a single united network.
- **Procedural Water & Singing Stone Audio**: Pure Web Audio synthesis with soothing water drop tones, resonant singing bowl chimes on island satisfaction, and harmonic pentatonic victory chords.
- **Tranquil High-DPI Water Canvas**: 60fps canvas renderer featuring ambient rippling water waves, glowing luminescent cyan bridges, and dynamic island satisfaction indicators (amber under, emerald satisfied, crimson over-capacity).
- **Quality-of-Life Controls**: Unlimited undo history, instant reset, intelligent deductive hint engine, sound toggle, and full level selection modal.
- **100% Offline & Private**: Zero external network dependencies, no tracking or ads, and complete PWA offline support with Cache-First Service Worker.
- **Cross-Platform**: Packaged for modern web browsers and native Android via Capacitor.

---

## 🏗️ Project Architecture

```
zenbridges/
├── .github/workflows/
│   ├── ci.yml            # Automated npm test & build on PRs
│   ├── pages.yml         # GitHub Pages automated deployment on main
│   └── android.yml       # Capacitor Android build & APK artifact generation
├── android/              # Native Android scaffold with Gradle wrapper
├── scripts/
│   ├── build.js          # Copies web runtime assets to www/
│   └── generate-levels.js# Generates & solver-verifies levels
├── src/
│   ├── index.html        # Main HTML layout and UI modals
│   ├── styles.css        # Responsive dark theme styling
│   ├── bridges-engine.js # Core Hashiwokakero puzzle engine & solver
│   ├── levels.js         # 50 solver-verified levels
│   ├── audio.js          # Procedural Web Audio synthesizer
│   ├── app.js            # Game controller, canvas rendering & touch handling
│   ├── manifest.json     # PWA manifest
│   ├── sw.js             # Offline Service Worker
│   └── icon.svg          # Vector icon
├── test/
│   └── engine.test.js    # Node.js logic tests (node --test)
├── capacitor.config.json # Capacitor app configuration (pk.offer.zenbridges)
├── package.json          # Build and test scripts
└── PLAY_LISTING.md       # Google Play Store listing and privacy declaration
```

---

## 🚀 Development & Build

### Prerequisites
- [Node.js](https://nodejs.org/) v20 or later
- (Optional for Android builds) Java JDK 21 & Android SDK

### Local Setup
```bash
# Clone the repository
git clone https://github.com/OfferPk/zenbridges.git
cd zenbridges

# Install dependencies
npm install

# Run automated logic tests
npm test

# Build runtime web assets to www/
npm run build
```

### Capacitor Android Build
```bash
# Sync web assets to native Android project
npx cap sync android

# Build debug APK locally
cd android
./gradlew assembleDebug
```
The resulting APK will be located at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
