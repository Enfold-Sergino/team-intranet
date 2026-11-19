/**
 * Schemas for field values in the core shapes adapters produce. They also normalise what the
 * components render: trimmed text, assets with a URL, safe link URLs.
 */
import { z } from "zod";
import type { Asset, PageRef, RichText, Tag } from "./model";
import { asString, asUrl } from "./text";

/** Trimmed; empty text becomes null. */
export const text = z.string().transform(asString);

/** http(s), mailto, tel, a site path or an anchor. Anything else (javascript:, data:) becomes null. */
export const url = z.string().transform(asUrl);

export const oneOf = <const T extends readonly [string, ...string[]]>(values: T) => z.enum(values);

export const number = z.number();

/** ISO date(time). */
export const date = z.string();

export const richText = z.custom<RichText>(
  (value) => typeof value === "object" && value !== null && (value as RichText).type === "root",
  "Expected rich text (a HAST root)",
);

/** Assets without a URL (still processing, deleted) become null. */
export const asset = z
  .looseObject({ url: z.string().nullish(), alt: z.string().nullish() })
  .transform((value): Asset | null =>
    value.url ? { url: value.url, alt: value.alt ?? null } : null,
  );

export const pageRef = z
  .looseObject({ id: z.string().nullish(), path: z.string().nullish() })
  .transform((value): PageRef => ({ id: value.id ?? null, path: value.path || "/" }));

export const tag = z
  .looseObject({
    id: z.string(),
    name: z.string().nullish(),
    path: z.string().nullish(),
    color: z.string().nullish(),
  })
  .transform((value): Tag => ({
    id: value.id,
    name: value.name || null,
    path: value.path ?? null,
    color: value.color ?? null,
  }));

/** A field with at most one value: missing values become null. */
export const one = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((value): z.output<T> | null => value ?? null);

/**
 * A field with several values. A single value counts as a list of one; missing values and values
 * that normalised to null (e.g. an asset without a URL) are dropped.
 */
export const many = <T extends z.ZodType>(schema: T) =>
  z
    .union([z.array(schema.nullish()), schema])
    .nullish()
    .transform((value) =>
      (value == null ? [] : Array.isArray(value) ? value : [value]).filter(
        (item): item is NonNullable<z.output<T>> => item != null,
      ),
    );
