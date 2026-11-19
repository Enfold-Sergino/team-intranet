import { hasElement, type Block, type RichText } from "@team-intranet/core";

/** Blocks that render the page's h1 themselves. */
export const TITLE_BLOCKS = new Set(["hero", "procedure-steps", "link-directory"]);

/** A first `content` block with a title acts as the page title (how editors build pages). */
export function firstBlockIsTitle(blocks: Block[]): boolean {
  const first = blocks[0];
  return (
    first?.type === "content" &&
    typeof first.props.title === "string" &&
    first.props.title.trim() !== ""
  );
}

const hasTitleBlock = (block: Block): boolean =>
  TITLE_BLOCKS.has(block.type) ||
  (block.type === "content" && hasElement(block.props.content as RichText, "h1")) ||
  block.children.some(hasTitleBlock);

/** The page's blocks already render its h1, so the route must not add one. */
export const rendersOwnTitle = (blocks: Block[]) =>
  firstBlockIsTitle(blocks) || blocks.some(hasTitleBlock);
