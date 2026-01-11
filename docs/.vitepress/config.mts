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
      { text: "Tutorials", link: "/tutorials/01-project-setup" },
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
          {
            text: "005: RFC 9457 Problem Details",
            link: "/decisions/0005-use-rfc9457-problem-details-for-errors",
          },
          {
            text: "006: Conventional Commits",
            link: "/decisions/0006-use-conventional-commits-and-branches",
          },
          {
            text: "007: GitHub Flow",
            link: "/decisions/0007-use-github-flow-workflow",
          },
        ],
      },
      {
        text: "Tutorials",
        items: [
          { text: "01: Project Setup", link: "/tutorials/01-project-setup" },
          { text: "02: Authentication", link: "/tutorials/02-authentication" },
          { text: "03: User Profile", link: "/tutorials/03-user-profile" },
        ],
      },
      {
        text: "Implementation Prompts",
        collapsed: true,
        items: [
          { text: "Meta: Tutorial Generator", link: "/prompts/00-meta-tutorial" },
          { text: "01: Project Setup", link: "/prompts/01-setup" },
          { text: "02: Authentication", link: "/prompts/02-authentication" },
          { text: "03: User Profile", link: "/prompts/03-user-profile" },
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
