import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { mdsvex } from "mdsvex";
import adapter from "svelte-adapter-bun";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [vitePreprocess(), mdsvex()],

  kit: {
    adapter: adapter(),
    alias: {
      "@api": "../api/src",
    },
  },

  extensions: [".svelte", ".svx"],
};

export default config;
