/**
 * The CDA responses the connector reads. Only what we rely on is checked (extra fields pass), so a
 * changed API fails with one error naming the field instead of a quietly empty page.
 */
import { z } from "zod";

const orNull = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((value): z.output<T> | null => value ?? null);
const orEmpty = z
  .string()
  .nullish()
  .transform((value) => value ?? "");

/** A field value in the "accessible" format: the value and its Plate value type. */
export const cdaValue = z.looseObject({ value: z.unknown(), valueType: z.string() });
export type CdaValue = z.output<typeof cdaValue>;
const cdaContent = z.record(z.string(), z.union([cdaValue, z.array(cdaValue)]));
export type CdaContent = z.output<typeof cdaContent>;

export const cdaItem = z.looseObject({
  prn: z.string(),
  contentTypeSlug: z.string(),
  displayName: orEmpty,
  primaryContentExperiencePrn: orNull(z.string()),
  tags: z.unknown().optional(),
  content: cdaContent.optional(),
});
export type CdaItem = z.output<typeof cdaItem>;

export interface CdaComponent {
  prn: string;
  name?: string | null;
  buildingBlockSlug: string;
  content?: CdaContent | null;
  components?: CdaComponent[] | null;
}
export const cdaComponent: z.ZodType<CdaComponent> = z.looseObject({
  prn: z.string(),
  name: z.string().nullish(),
  buildingBlockSlug: z.string(),
  content: cdaContent.nullish(),
  get components() {
    return z.array(cdaComponent).nullish();
  },
});

export const cdaExperience = z.looseObject({
  prn: z.string(),
  title: orEmpty,
  slug: orEmpty,
  path: orNull(z.string()),
  seoTitle: orNull(z.string()),
  seoDescription: orNull(z.string()),
  updatedAt: orNull(z.string()),
  lastPublished: orNull(z.string()),
  tags: z.unknown().optional(),
  primaryContentItemPrn: orNull(z.string()),
  experienceComponent: cdaComponent,
});
export type CdaExperience = z.output<typeof cdaExperience>;

export const cdaItemPage = z.looseObject({
  entities: z.array(cdaItem),
  meta: z.looseObject({ pagination: z.looseObject({ totalPages: z.number() }) }),
});

/** v0 experience list (cursor pagination); only used to discover paths. */
export const cdaExperienceList = z.looseObject({
  data: z.array(
    z.looseObject({
      cursor: z.string(),
      node: z.looseObject({
        isPublished: z.boolean().nullish(),
        pathPart: z.looseObject({ path: z.string().nullish() }).nullish(),
      }),
    }),
  ),
});
