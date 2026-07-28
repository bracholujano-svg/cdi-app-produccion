# Design System Strategy: The Cinematic Discovery Language

## 1. Overview & Creative North Star: "The Digital Projectionist"
The goal of this design system is to transform a mobile interface into a private screening room. Our Creative North Star is **"The Digital Projectionist."** We are moving away from the "app-in-a-box" look toward an immersive, editorial experience that mirrors the high-contrast, moody atmosphere of indie cinema. 

We reject the rigid, utilitarian grid in favor of **Intentional Asymmetry**. Poster art should bleed into the background, and navigation should feel like light caught on a lens. By utilizing deep pitch-black depths (`surface-dim`) and vibrant neon highlights (`primary`), we create a visual rhythm that guides the eye through a curated narrative rather than a spreadsheet of metadata.

---

## 2. Colors: Depth & Neon Pulse
The palette is built on the high-contrast relationship between absolute darkness and electric light.

### The "No-Line" Rule
**Borders are strictly prohibited for sectioning.** To separate content, you must use background shifts. For example, a "Related Films" section should be wrapped in `surface-container-low` while sitting on a `surface` background. This creates a natural, soft transition that maintains the cinematic immersion.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of film gels and glass.
*   **Base Level:** `surface-dim` (#131313) or `surface-container-lowest` (#0e0e0e) for the deep, "black hole" background.
*   **Interaction Level:** `surface-container` (#1f1f1f) for main content areas.
*   **Top Level:** `surface-container-highest` (#353535) for cards or floating panels.
*   **The "Glass & Gradient" Rule:** Floating navigation bars and playback controls must use `surface-variant` with a 60% opacity and a 20px-30px backdrop-blur (Glassmorphism). 

### Signature Textures
Main CTAs must not be flat. Use a linear gradient from `primary` (#ffb1c3) to `primary-container` (#ff4b89) at a 135-degree angle to create a "glowing neon" effect that feels alive.

---

## 3. Typography: Editorial Authority
Our typography pairs a high-character display face with a functional, high-readability body face.

*   **Display & Headlines (Space Grotesk):** Use `display-lg` and `headline-lg` to create "Movie Poster" moments. The wide apertures and modern geometry of Space Grotesk should be used to anchor the top of screens with bold, authoritative weight.
*   **Body & Labels (Inter):** Inter handles the "metadata." It is neutral and disappears, allowing the film titles and posters to remain the hero. 
*   **Hierarchy:** Use `on-surface-variant` (#e5bcc4) for secondary metadata (year, genre) to pull it back visually, ensuring it doesn't compete with the `on-surface` (#e2e2e2) primary text.

---

## 4. Elevation & Depth: Tonal Layering
Traditional material shadows are too heavy for a "pitch black" UI. We use light, not shadow, to define space.

*   **The Layering Principle:** Place a `surface-container-high` card over a `surface` background. The subtle shift from #131313 to #2a2a2a is enough to define the edge without a line.
*   **Ambient Glows:** When a floating effect is required (e.g., a "Watch Now" FAB), use an ambient shadow tinted with the `primary` color at 10% opacity. This mimics the light spill from a neon sign onto a dark street.
*   **The "Ghost Border" Fallback:** If accessibility requires a stroke (e.g., an unselected filter chip), use `outline-variant` (#5c3f45) at **20% opacity**. It should be felt, not seen.

---

## 5. Components: The Indie Toolkit

### Buttons (Pill-Shaped)
All buttons use the `full` roundedness token (9999px).
*   **Primary:** Neon gradient (`primary` to `primary-container`). White text (`on-primary`). No border.
*   **Secondary:** Glassmorphic base. `surface-variant` at 40% opacity with backdrop-blur. 
*   **Tertiary:** Text-only in `primary` (#ffb1c3), used for low-emphasis actions like "See All."

### Cards & Lists (The "Breathable" Grid)
*   **Forbid Dividers:** Never use a 1px line to separate list items. Use `3` (1rem) or `4` (1.4rem) spacing from the scale to create a "Gutter of Silence."
*   **Poster Cards:** Use `lg` (2rem) rounded corners. Apply a subtle inner-glow (a 1px inset border at 10% opacity `primary`) to make posters pop against the black background.

### The "Film Strip" Carousel
A custom component where the center item is scaled 1.1x and the side items use `surface-variant` overlays to "dim" them into the background, focusing the user's attention solely on the active selection.

### Glassmorphic Navigation Bar
A floating pill-shaped bar at the bottom of the screen. 
*   **Background:** `surface-container-low` at 70% opacity.
*   **Blur:** 24px.
*   **Active State:** The active icon should sit on a small `primary` glow, not a solid background.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use extreme vertical white space (`16` or `20` tokens) to separate different film genres or categories.
*   **Do** allow film posters to bleed behind the status bar and navigation bar using gradients that fade to `surface-dim`.
*   **Do** use `tertiary` (#00dbe9) sparingly for "Success" states or "New" badges to provide a cool contrast to the hot magenta.

### Don’t:
*   **Don’t** use pure white (#FFFFFF) for text. Use `on-surface` (#e2e2e2) to reduce eye strain in the dark environment.
*   **Don’t** use standard "Drop Shadows." They look muddy on deep charcoal. Use Tonal Layering.
*   **Don’t** use sharp corners. Everything in this system should feel fluid and polished, using the `md` to `full` roundedness scale.