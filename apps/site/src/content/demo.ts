/**
 * Invented demo content: lets CI build the site and anyone try it without a CMS
 * (CONTENT_SOURCE=demo). It uses every block type once, two languages and a procedure sequence.
 */
import type { Block, ContentSource, Item, Page, RichText, Tag } from "@team-intranet/core";
import type { Element, ElementContent, Text } from "hast";

const text = (value: string): Text => ({ type: "text", value });
const el = (tagName: string, ...children: ElementContent[]): Element => ({
  type: "element",
  tagName,
  properties: {},
  children,
});
/** Paragraphs from strings. */
const rich = (...paragraphs: string[]): RichText => ({
  type: "root",
  children: paragraphs.map((p) => el("p", text(p))),
});

let ids = 0;
const block = (type: string, props: Record<string, unknown>, children: Block[] = []): Block => ({
  id: `demo:block:${++ids}`,
  type,
  name: null,
  props,
  children,
});
const page = (
  path: string,
  title: string,
  blocks: Block[] = [],
  extra: Partial<Page> = {},
): Page => ({
  id: `demo:page:${path}`,
  path,
  treeId: path,
  parentTreeId: path === "/" ? null : path.split("/").slice(0, -1).join("/") || "/",
  title,
  seoTitle: null,
  description: null,
  tags: [],
  updatedAt: null,
  publishedAt: null,
  primaryItem: null,
  blocks,
  ...extra,
});
const item = (
  type: string,
  title: string,
  data: Record<string, unknown>,
  extra: Partial<Item> = {},
): Item => ({
  id: `demo:item:${type}:${title}`,
  type,
  title,
  tags: [],
  locale: null,
  pageId: null,
  data,
  ...extra,
});
const tag = (id: string, path: string, color: string | null = null): Tag => ({
  id,
  name: path.split("/").pop()!,
  path,
  color,
});

const tools = tag("demo:tag:tools", "Tools", "#3b3bd6");
const hr = tag("demo:tag:hr", "HR", "#047857");
const ada = { name: "Ada Example", role: "Product owner", email: "ada@example.com", photo: null };
const linus = { name: "Linus Sample", role: "Developer", email: "linus@example.com", photo: null };
const links = [
  item("link", "Handbook", {
    title: "Handbook",
    url: "https://example.com/handbook",
    description: "How we work",
    category: tools,
  }),
  item("link", "Time sheets", {
    title: "Time sheets",
    url: "https://example.com/time",
    description: "Book your hours",
    category: tools,
  }),
  item("link", "Leave", {
    title: "Leave",
    url: "/procedure-overview/onboarding/accounts",
    description: "Request a day off",
    category: hr,
  }),
];
const project = item("project", "Apollo", {
  title: "Apollo",
  summary: "A new intranet for the team.",
  client: "Example Corp",
  status: "active",
  team: [ada, linus],
  links: [],
});
const procedure = (title: string, steps: string[]) =>
  item("procedure", title, {
    title,
    summary: `How to ${title.toLowerCase()}.`,
    category: hr,
    owner: ada,
    lastReviewed: "2026-11-01",
    steps: steps.map((step) => ({ title: step, body: rich(`Do this: ${step.toLowerCase()}.`) })),
  });

const pages: Page[] = [
  page("/", "Home", [
    block("hero", {
      title: "Welcome to the team intranet",
      intro: rich("Everything you need, in one place."),
      ctaLabel: "Our projects",
      ctaLink: { id: null, path: "/projects" },
    }),
    block("quick-links", { title: "Quick links", links: links.map((l) => l.data) }),
    block("section", { title: "News", intro: "What happened this week.", columns: 2 }, [
      block("content", { title: "New office", content: rich("We moved to a bigger office.") }),
      block("callout", { tone: "success", title: "Launched", body: rich("The intranet is live.") }),
    ]),
  ]),
  page("/about", "About", [
    block("content", {
      title: "About us",
      content: {
        type: "root",
        children: [
          el(
            "p",
            text("We are a small team. Read the "),
            { ...el("a", text("handbook")), properties: { href: "https://example.com/handbook" } },
            text("."),
          ),
          el("h2", text("Values")),
          el("ul", el("li", el("p", text("Be kind"))), el("li", el("p", text("Ship small")))),
        ],
      },
    }),
    block("team-list", { title: "Team", people: [ada, linus] }),
    block("table", {
      header: "Name | Role",
      content: ["Ada | Product owner", "Linus | [Developer](/about)"],
    }),
    block("image", { image: { url: "/assets/logo.svg", alt: "Logo" }, altText: "Team logo" }),
    block("gallery", {
      title: "Office",
      images: [{ url: "/assets/logo.svg", alt: null }],
      columns: 3,
    }),
    block("cards", {
      title: "Teams",
      columns: 2,
      cards: [
        { title: "Design", body: rich("Makes it nice."), link: "/about" },
        { title: "Build", body: rich("Makes it work."), link: null },
      ],
    }),
  ]),
  page("/links", "Links", [block("link-directory", { title: "Links" })]),
  page("/projects", "Projects", [
    block("experience-list", { title: "All projects", contentType: "project", view: "cards" }),
  ]),
  page(
    "/projects/apollo",
    "Apollo",
    [block("content", { title: null, content: rich("The Apollo project.") })],
    { primaryItem: project },
  ),
  page("/procedure-overview", "Procedures"),
  page("/procedure-overview/onboarding", "Onboarding"),
  page("/procedure-overview/onboarding/accounts", "1. Accounts", [block("procedure-steps", {})], {
    primaryItem: procedure("Get your accounts", ["Laptop", "E-mail"]),
  }),
  page("/procedure-overview/onboarding/tools", "2. Tools", [block("procedure-steps", {})], {
    primaryItem: procedure("Install your tools", ["Editor", "VPN"]),
  }),
  page("/nl", "Home", [
    block("content", { title: "Welkom", content: rich("Het intranet in het Nederlands.") }),
  ]),
  page("/nl/about", "Over ons", [
    block("content", { title: "Over ons", content: rich("Wij zijn een klein team.") }),
  ]),
];

const items: Item[] = [
  item("site-settings", "Settings", {
    siteName: "Team intranet (demo)",
    footerText: "Demo content",
    primaryNavigation: [
      { id: null, path: "/about" },
      { id: null, path: "/projects" },
    ],
  }),
  ...links,
  { ...project, pageId: "demo:page:/projects/apollo" },
];

export const demoSource: ContentSource = {
  load: async () => ({
    pages,
    items,
    fetchedAt: "2026-01-01T09:00:00.000Z",
    redirects: { "/home": "/" },
  }),
};
