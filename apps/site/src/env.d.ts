interface ImportMetaEnv {
  /** plate (default) or demo: invented content for CI and trying the site without a CMS. */
  readonly CONTENT_SOURCE?: string;
  /** code:label:name:root, e.g. "en-GB:EN:English:/,nl-NL:NL:Nederlands:/nl". */
  readonly SITE_LANGUAGES?: string;
  readonly PLATE_DELIVERY_TOKEN?: string;
  readonly PLATE_CDA_URL?: string;
  readonly PLATE_LANGUAGE_PRNS?: string;
  readonly PLATE_HOME_PATH?: string;
}
