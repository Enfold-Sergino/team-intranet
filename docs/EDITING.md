# Editing the intranet

For everyone who writes or maintains pages. You only work in Plate: the site is rebuilt from what is
published.

## The basics

- **A page is a content experience** in the intranet channel. Its path decides where it sits in the
  sidebar: `/p-o/onboarding/useful-links` appears below the `/p-o/onboarding` page.
- **Pages are built from blocks.** Start most pages with a `content` block: its title becomes the
  page title.
- **Reusable data lives in content items** (people, links, projects, procedures, cards). Edit an item
  once and every page that lists it is updated.
- **The sidebar sorts child pages by title**, numbers in order ("Lesson 2" before "Lesson 10"). The
  order of the top-level pages comes from the _site settings_ item (`primary-navigation`).
- **Languages:** English pages live at `/…`, Dutch pages at `/nl/…`. Give the Dutch version the same
  path under `/nl` and the language switch links them.

## Which block do I use?

| I want to…                                         | Block             | Notes                                                                   |
| -------------------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| Write text with headings, lists and links          | `content`         | The first one on the page gives the page its title.                     |
| Show a banner with an intro and a button           | `hero`            | Mostly for the homepage.                                                |
| Add a notice, tip or warning                       | `callout`         | Pick a tone: `info`, `warning` or `success`.                            |
| Start a new part of the page with a heading        | `section`         | Title + short intro; blocks inside it are laid out in 1–3 columns.      |
| Show one image                                     | `image`           | Always fill in the alt text: it describes the image for screen readers. |
| Show several images in a grid                      | `gallery`         |                                                                         |
| Show a table                                       | `table`           | See _Tables_ below.                                                     |
| Show a grid of cards                               | `cards`           | Create `card` items first, then pick them in the block.                 |
| Link to a few important tools or pages             | `quick-links`     | Pick `link` items.                                                      |
| Show all useful links, grouped by category         | `link-directory`  | Optionally only one category tag.                                       |
| Introduce the people on a team or project          | `team-list`       | Pick `person` items.                                                    |
| List the pages below a page (projects, procedures) | `experience-list` | See _Overviews_ below.                                                  |
| Show the steps of a procedure                      | `procedure-steps` | Uses the page's primary content item if you don't pick a procedure.     |

## Tables

Each row is one line in the `content` field; separate the columns with `|`. Put the column names in
`header`:

```
header:   Name | Role | Contact
content:  Noor | Product owner | [Mail](mailto:noor@example.com)
          Sam  | Developer     | [Profile](/people/sam)
```

Links are written as `[label](url)`.

## Overviews and the primary content item

An `experience-list` block shows the pages below a page as cards or a list. Each card takes its
title, summary, image and status from the page's **primary content item** (set it in the page's
settings in Plate). So for a project page: create a `project` item and make it the page's primary
content item. Without one, the card falls back to the page's SEO description or the start of its
first text.

Useful settings on the block: `content-type` (`project` or `procedure`) to list only that kind of
page, `view` (`cards` or `list`), `tag` to filter, `limit`, and `parent` to list the pages below
another page.

Good to know:

- A page with only a title and no other content lists its child pages automatically.
- Procedure pages get **Previous / Next** buttons to the procedures next to them. Pages under
  `/procedure-overview` (the introduction course) are read in order, like a book.

## Links and tags

- Link to other intranet pages by their path (`/p-o/onboarding`), not by the full site address.
- `link` items are grouped by their category tag. Add a new tag to create a new group.

## Previewing

Plate's live editor shows your unsaved changes in the real site design. Blocks that list _other_
pages or items (overviews, link directories, previous/next) need the published pages: the preview
asks you to **sign in** with the intranet login once. The lists show what is _published_: a page you
haven't published yet doesn't appear in them. If a block has a problem (for example a value that
isn't allowed), the preview shows it on the block.

## After publishing

1. Wait for the rebuild, then reload the page. The footer shows **"Content updated …"** with the time
   of the last build: if that is from before you published, the update hasn't gone through yet.
2. If something you added is missing, it has a problem and was left out; the rest is published as
   usual. The build report lists **content left out** (page, block or item, field and what's wrong)
   and **broken links** (links to pages that don't exist). Fix it in Plate and publish again.
3. Still stuck? Ask a developer to check the latest build.

## Don'ts

- Don't give two pages the same path: the site won't build until one is changed.
- Don't upload confidential files (resumes, contracts, invoices) to Plate. The pages are behind a
  login, but uploaded images and documents are served to anyone who has the link. Put those files in
  SharePoint or Google Drive and link to them.
