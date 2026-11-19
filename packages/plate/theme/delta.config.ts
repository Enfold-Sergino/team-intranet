// Delta CLI config, used by `pnpm plate:sync` (`delta theme sync`). Written by hand: `delta theme
// init` only supports Next and Nuxt.
const prn = process.env.PLATE_THEME_PRN;
if (!prn)
  throw new Error(
    "Set PLATE_THEME_PRN in packages/plate/theme/.env: the full PRN of the theme in Plate.",
  );

export default {
  directories: {
    // The CLI writes Vue components here (scripts/sync.ts deletes them) and the theme into `content`.
    components: ".delta/components",
    content: ".delta/fetched",
  },
  theme: { name: "team ida", prn },
};
