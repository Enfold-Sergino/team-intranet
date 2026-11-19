/**
 * The connection with Plate's editor window: receive drafts, report clicked blocks. Only Plate's own
 * editor origins may send content to the preview.
 */
import { environmentEditorUrlMap } from "@platecms/delta-client/api";
import { ConnectorEventType, WindowConnectorClient } from "@platecms/delta-client/connectors";
import type { ContentExperience, ExperienceComponent } from "@platecms/delta-client/graphql";
import type { Block, Page } from "@team-intranet/core";
import { blocksFromDraft, pageFromDraft } from "./draft";

export interface EditorHandlers {
  /** A whole draft page arrived. */
  onPage: (page: Page) => void;
  /** Only the blocks of the current page changed. */
  onBlocks: (blocks: Block[]) => void;
  onError?: (error: unknown) => void;
}

export interface EditorConnection {
  /** Tell the editor a block was clicked, so it selects it. */
  select: (block: Pick<Block, "id" | "editorId">) => void;
}

/** Plate's editor origins (not the local development one). */
export const editorOrigins = () =>
  Object.entries(environmentEditorUrlMap)
    .filter(([env]) => env !== "local")
    .map(([, url]) => new URL(url).origin);

/** Null when the page isn't embedded in an editor. */
export function connectEditor(handlers: EditorHandlers): EditorConnection | null {
  if (window.parent === window) return null;
  const allowed = editorOrigins();
  const ancestor =
    location.ancestorOrigins?.[0] ?? (document.referrer ? new URL(document.referrer).origin : "");
  const origin = allowed.includes(ancestor)
    ? ancestor
    : (allowed.find((o) => o.includes("platecms.app")) ?? allowed[0]!);
  const client = new WindowConnectorClient(window, { origin, window: window.parent });

  client.on("message", (event) => {
    try {
      if (event.type === ConnectorEventType.CONTENT_EXPERIENCE_SEND)
        handlers.onPage(pageFromDraft(event.payload as ContentExperience));
      else if (event.type === ConnectorEventType.ROOT_EXPERIENCE_COMPONENT_SEND)
        handlers.onBlocks(blocksFromDraft(event.payload as ExperienceComponent));
    } catch (error) {
      handlers.onError?.(error);
    }
  });

  return {
    select(block) {
      if (!block.editorId) return;
      const payload = { prn: block.editorId, experienceComponentPrn: block.id };
      client.send({ type: ConnectorEventType.PLACEMENT_CLICKED, payload });
      // Older Delta dashboards only listen to the deprecated event.
      client.send({ type: ConnectorEventType.GRID_PLACEMENT_CLICKED, payload });
    },
  };
}
