import { defineConfig } from "vite";

// Relative base so the built output can be hosted from any subfolder
// (e.g. /minigames/pengu_rush/v1.0.0/) instead of only the domain root.
export default defineConfig({
  base: "./",
});
