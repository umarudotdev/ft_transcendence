import { defineConfig } from "vitepress";

export default defineConfig({
  title: "ft_transcendence",
  description:
    "Real-time Pong platform for 42 curriculum with multiplayer gameplay, chat, and 2FA",
  base: "/ft_transcendence/",
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "PRD", link: "/prd" },
      { text: "Architecture", link: "/architecture" },
      { text: "Development", link: "/development" },
    ],

    sidebar: [
      {
        text: "Overview",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Product Requirements", link: "/prd" },
          { text: "Milestones", link: "/milestones" },
        ],
      },
      {
        text: "Technical",
        items: [
          { text: "Architecture", link: "/architecture" },
          { text: "Development Guide", link: "/development" },
        ],
      },
      {
        text: "Decisions (ADRs)",
        collapsed: true,
        items: [
          {
            text: "001: Bun + Elysia + SvelteKit",
            link: "/decisions/0001-use-bun-elysia-sveltekit-stack",
          },
          {
            text: "002: Monorepo + Vertical Slices",
            link: "/decisions/0002-use-monorepo-with-vertical-slice-architecture",
          },
          {
            text: "003: Tailwind + Shadcn + Stores",
            link: "/decisions/0003-use-tailwind-shadcn-svelte-stores",
          },
          {
            text: "004: Database Sessions",
            link: "/decisions/0004-use-database-sessions-with-arctic-oslo",
          },
        ],
      },
      {
        text: "Reference",
        collapsed: true,
        items: [{ text: "42 Subject", link: "/subject" }],
      },
    ],

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/umarudotdev/ft_transcendence",
      },
    ],

    footer: {
      message: "42 Curriculum Project",
      copyright: "ft_transcendence",
    },

    outline: {
      level: [2, 3],
    },
  },
});
