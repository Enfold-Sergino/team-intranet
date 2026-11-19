/**
 * Block components by block type, found by file name: `src/blocks/ExperienceListBlock.astro`
 * renders type `experience-list`. Adding a block is adding a file (and its schema in core).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each block has its own props
type BlockComponent = (props: any) => any;

/** "./ExperienceListBlock.astro" → "experience-list"; null when the name doesn't follow the rule. */
export function typeFromFileName(file: string): string | null {
  const name = /(?:^|\/)([A-Z][A-Za-z0-9]*)Block\.astro$/.exec(file)?.[1];
  return name ? name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase() : null;
}

/** "experience-list" → "ExperienceListBlock.astro" (the file to create for a new block). */
export const fileNameForType = (type: string) =>
  `${type.replace(/(^|[-_])([a-z0-9])/g, (_, __, c: string) => c.toUpperCase())}Block.astro`;

const modules = import.meta.glob<{ default: BlockComponent }>("../../blocks/*Block.astro", {
  eager: true,
});

export const blocks: Record<string, BlockComponent> = Object.fromEntries(
  Object.entries(modules).map(([file, module]) => {
    const type = typeFromFileName(file);
    if (!type) throw new Error(`${file} doesn't follow the <Name>Block.astro naming`);
    return [type, module.default];
  }),
);
