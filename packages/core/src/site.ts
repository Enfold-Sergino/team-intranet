/**
 * Read access to loaded content: page tree, navigation, languages and reading order. Built once per
 * build; every lookup that would otherwise scan all pages is indexed on first use.
 */
import { defaultLanguage, languageOf, translatePath, withRoot, type Language } from "./languages";
import type { Asset, Item, Page, PageRef, SiteContent } from "./model";
import { itemData } from "./schemas";
import { compareTitles, parentPath } from "./text";

export interface SiteOptions {
  /** From parseLanguages: longest root first. */
  languages: Language[];
  /** Sections read like a book: every page below them gets previous/next links. */
  sequenceSections?: readonly string[];
  /** Used when there is no site-settings item. */
  siteName?: string;
}

export interface SiteSettings {
  siteName: string;
  logo: Asset | null;
  primaryNavigation: PageRef[];
  footerText: string | null;
}

export interface NavNode {
  title: string;
  path: string;
  children: NavNode[];
}

export interface LanguageLink {
  language: Language;
  href: string;
  current: boolean;
  /** False when the page has no version in that language: the link goes to that language's home. */
  exists: boolean;
}

/** A tree position: a page, or a parent that has no page of its own. */
type Node = Pick<Page, "treeId" | "path">;

/** A page built around a procedure. */
export const isProcedurePage = (page: Page) =>
  page.primaryItem?.type === "procedure" || page.blocks.some((b) => b.type === "procedure-steps");

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

export class Site {
  /** The language this site is scoped to, or null for the whole site. */
  readonly language: Language | null;
  #whole: Site;
  #byPath?: Map<string, Page>;
  #byParentTree?: Map<string, Page[]>;
  #byParentPath?: Map<string, Page[]>;
  #navigation?: NavNode[];
  #settings?: SiteSettings;
  #languages = new Map<string, Site>();
  #sequences = new Map<string, Page[]>();

  constructor(
    readonly content: SiteContent,
    readonly options: SiteOptions,
    scope?: { whole: Site; language: Language },
  ) {
    this.language = scope?.language ?? null;
    this.#whole = scope?.whole ?? this;
  }

  get pages(): Page[] {
    return this.content.pages;
  }

  get items(): Item[] {
    return this.content.items;
  }

  /** Root path: "/" for the whole site, else the language's root. */
  get root(): string {
    return this.language?.root ?? "/";
  }

  page(path: string | null | undefined): Page | undefined {
    return path == null ? undefined : this.#index().byPath.get(path);
  }

  /** The closest existing page above `path`. */
  nearestAncestor(path: string): Page | undefined {
    const { byPath } = this.#index();
    for (let p = parentPath(path); p !== null; p = parentPath(p)) {
      const page = byPath.get(p);
      if (page) return page;
    }
    return undefined;
  }

  /** A page's title: its primary item's title, else its own. */
  title(page: Page): string {
    const title = page.primaryItem?.data.title;
    return typeof title === "string" && title ? title : page.title;
  }

  /** Child pages in title order. */
  children(parent: Node): Page[] {
    const { byParentTree, byParentPath } = this.#index();
    const children = new Set([
      ...(byParentTree.get(parent.treeId) ?? []),
      ...(byParentPath.get(parent.path) ?? []).filter((p) => p.path !== parent.path),
    ]);
    return [...children].sort((a, b) => compareTitles(this.title(a), this.title(b)));
  }

  /** Existing pages from the root down to `page`. */
  breadcrumbs(page: Page): Page[] {
    const trail: Page[] = [];
    for (let path: string | null = page.path; path !== null; path = parentPath(path)) {
      const match = this.page(path);
      if (match) trail.unshift(match);
    }
    return trail;
  }

  itemsOfType(type: string): Item[] {
    return this.items.filter((item) => item.type === type);
  }

  get settings(): SiteSettings {
    if (this.#settings) return this.#settings;
    const data = itemData(this.itemsOfType("site-settings")[0], "site-settings");
    return (this.#settings = {
      siteName: data?.siteName ?? this.options.siteName ?? "Intranet",
      logo: data?.logo ?? null,
      primaryNavigation: data?.primaryNavigation ?? [],
      footerText: data?.footerText ?? null,
    });
  }

  /**
   * Sidebar tree. Top level = children of the root plus pages whose parent is missing (not
   * translated yet), ordered by the settings' primary navigation, then by title. Read-only.
   */
  navigation(): NavNode[] {
    if (this.#navigation) return this.#navigation;
    const { root } = this;
    const language = languageOf(root, this.options.languages);
    const order = this.settings.primaryNavigation.map((ref) => withRoot(ref.path, language));
    const known = new Set(this.pages.map((p) => p.treeId));
    const home = this.page(root);

    const toNode = (page: Page, depth: number): NavNode => ({
      title: this.title(page),
      path: page.path,
      children: depth > 4 ? [] : this.children(page).map((child) => toNode(child, depth + 1)),
    });
    const topLevel = this.pages.filter((p) => {
      if (p.path === root) return false;
      if (home && (p.parentTreeId === home.treeId || parentPath(p.path) === root)) return true;
      if (p.parentTreeId && known.has(p.parentTreeId)) return false;
      const ancestor = this.nearestAncestor(p.path);
      return !ancestor || ancestor.path === root;
    });
    const rank = (path: string) => {
      const i = order.indexOf(path);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const nodes = topLevel
      .sort((a, b) => rank(a.path) - rank(b.path) || compareTitles(this.title(a), this.title(b)))
      .map((p) => toNode(p, 1));
    return (this.#navigation = home
      ? [{ title: this.title(home), path: root, children: [] }, ...nodes]
      : nodes);
  }

  /** Is `node` the current page or one of its ancestors? A language home matches only itself. */
  isActive(node: NavNode, current: string): boolean {
    const isHome = node.path === languageOf(node.path, this.options.languages).root;
    return isHome
      ? current === node.path
      : current === node.path || current.startsWith(`${node.path}/`);
  }

  /**
   * The pages and items of one language. Items without a locale are shared; an item type with no
   * items in this language borrows the default language's (untranslated links still show).
   */
  forLanguage(language: Language): Site {
    if (this.#whole !== this) return this.#whole.forLanguage(language);
    let site = this.#languages.get(language.code);
    if (site) return site;
    const { languages } = this.options;
    const fallback = defaultLanguage(languages).code;
    const own = this.items.filter((i) => !i.locale || i.locale === language.code);
    const ownTypes = new Set(own.filter((i) => i.locale).map((i) => i.type));
    const borrowed = this.items.filter(
      (i) => i.locale === fallback && fallback !== language.code && !ownTypes.has(i.type),
    );
    site = new Site(
      {
        ...this.content,
        pages: this.pages.filter((p) => languageOf(p.path, languages).code === language.code),
        items: [...own, ...borrowed],
      },
      this.options,
      { whole: this, language },
    );
    this.#languages.set(language.code, site);
    return site;
  }

  /** One link per language: the same page in that language, else that language's home. */
  languageLinks(path: string): LanguageLink[] {
    const { languages } = this.options;
    const current = languageOf(path, languages);
    return [...languages]
      .sort((a, b) => a.root.length - b.root.length)
      .map((language) => {
        if (language.code === current.code)
          return { language, href: path, current: true, exists: true };
        const target = translatePath(path, language, languages);
        const exists = Boolean(this.#whole.page(target));
        return { language, href: exists ? target : language.root, current: false, exists };
      });
  }

  /** Pages below `section` depth-first (a page, then its sub-pages), in navigation order. */
  readingOrder(section: Node, include: (page: Page) => boolean = () => true): Page[] {
    const order: Page[] = [];
    const seen = new Set<string>();
    const visit = (parent: Node) => {
      for (const child of this.children(parent)) {
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        if (include(child)) order.push(child);
        visit(child);
      }
    };
    visit(section);
    return order;
  }

  /**
   * Previous and next page. A page below a sequence section walks that section's reading order;
   * otherwise a procedure page walks the procedure pages next to it.
   */
  neighbours(page: Page): { previous: Page | null; next: Page | null } {
    const sequence = this.#sequenceOf(page);
    if (!sequence) return { previous: null, next: null };
    let order = this.#sequences.get(sequence.key);
    if (!order) {
      order = this.readingOrder(sequence.section, sequence.include);
      this.#sequences.set(sequence.key, order);
    }
    const i = order.findIndex((p) => p.id === page.id);
    return i === -1
      ? { previous: null, next: null }
      : { previous: order[i - 1] ?? null, next: order[i + 1] ?? null };
  }

  #sequenceOf(page: Page) {
    const sections = this.options.sequenceSections ?? [];
    for (let path = parentPath(page.path); path !== null; path = parentPath(path)) {
      const section = sections.includes(path) ? this.page(path) : undefined;
      if (section) return { key: `${path}|all`, section, include: () => true };
    }
    const parent = parentPath(page.path);
    if (!isProcedurePage(page) || parent === null) return null;
    return {
      key: `${parent}|procedures`,
      section: { treeId: page.parentTreeId ?? parent, path: parent },
      include: isProcedurePage,
    };
  }

  /**
   * Children hang under their parent's treeId; a page whose parent doesn't exist (e.g. not
   * translated yet) hangs under its nearest existing ancestor instead of falling out of the tree.
   */
  #index() {
    if (this.#byPath && this.#byParentTree && this.#byParentPath)
      return {
        byPath: this.#byPath,
        byParentTree: this.#byParentTree,
        byParentPath: this.#byParentPath,
      };
    const byPath = (this.#byPath = new Map());
    const byParentTree = (this.#byParentTree = new Map<string, Page[]>());
    const byParentPath = (this.#byParentPath = new Map<string, Page[]>());
    for (const p of this.pages) if (!byPath.has(p.path)) byPath.set(p.path, p);
    const treeIds = new Set(this.pages.map((p) => p.treeId));
    for (const p of this.pages) {
      if (p.parentTreeId !== null && treeIds.has(p.parentTreeId))
        push(byParentTree, p.parentTreeId, p);
      else {
        const parent = this.nearestAncestor(p.path)?.path ?? parentPath(p.path);
        if (parent !== null) push(byParentPath, parent, p);
      }
    }
    return { byPath, byParentTree, byParentPath };
  }
}

export const createSite = (content: SiteContent, options: SiteOptions) =>
  new Site(content, options);
