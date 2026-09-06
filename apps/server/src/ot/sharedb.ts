import ShareDB, { type Error as ShareDBError } from 'sharedb';

export const CANVAS_DOC_TYPE = 'json0';

export interface CanvasDocument {
  objects: Record<string, unknown>;
  background?: string;
}

type ShareDoc = ShareDB.Doc;

const backend = new ShareDB();
const docs = new Map<string, ShareDoc>();

function initialCanvas(): CanvasDocument {
  return { objects: {}, background: '#ffffff' };
}

export async function getCanvasDocument(boardId: string): Promise<ShareDoc> {
  const existing = docs.get(boardId);
  if (existing) return existing;

  const connection = backend.connect();
  const doc = connection.get('boards', boardId);

  await new Promise<void>((resolve, reject) => {
    doc.fetch((error: ShareDBError) => {
      if (error) {
        reject(error);
        return;
      }
      if (doc.type === null) {
        doc.create(initialCanvas(), CANVAS_DOC_TYPE, (createError: ShareDBError) => {
          if (createError) reject(createError);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  });

  docs.set(boardId, doc);
  return doc;
}

export function submitCanvasOperation(doc: ShareDoc, operation: unknown, source?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    doc.submitOp(operation, { source }, (error: ShareDBError) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
