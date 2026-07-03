// Attachments — pure store reducer that validates and accumulates files, plus
// the drag-and-drop handler factory. The store owns the state cell; this owns
// the rules.

import {
  type AttachmentItem,
  matchesAccept,
  revokeAllAttachmentUrls,
  revokeAttachmentUrl,
  toAttachmentItem,
} from "../attachments";

export type AttachmentStoreState = {
  items: AttachmentItem[];
  error: string | null;
};

export type AttachmentStoreAction =
  | { type: "add"; files: File[] | FileList }
  | { type: "remove"; id: string }
  | { type: "reset" };

export type AttachmentStoreConfig = {
  accept: string;
  maxFiles: number;
  maxFileSize: number;
};

export const INITIAL_ATTACHMENT_STATE: AttachmentStoreState = {
  items: [],
  error: null,
};

export const attachmentReducer = (
  state: AttachmentStoreState,
  action: AttachmentStoreAction,
  config: AttachmentStoreConfig,
): AttachmentStoreState => {
  switch (action.type) {
    case "add": {
      const incoming = [...action.files];
      if (!incoming.length) return state;

      const accepted = incoming.filter((file) => matchesAccept(file, config.accept));
      if (!accepted.length) {
        return { ...state, error: "No files match the accepted types." };
      }

      const sized = accepted.filter((file) => file.size <= config.maxFileSize);
      if (!sized.length) {
        return { ...state, error: "All files exceed the maximum size." };
      }

      const capacity = Math.max(0, config.maxFiles - state.items.length);
      const capped = sized.slice(0, capacity);

      const overCapacityError =
        sized.length > capacity ? "Too many files. Some were not added." : null;

      if (!capped.length) {
        return { ...state, error: overCapacityError ?? state.error };
      }

      return {
        items: [...state.items, ...capped.map(toAttachmentItem)],
        error: overCapacityError,
      };
    }
    case "remove": {
      const found = state.items.find((item) => item.id === action.id);
      if (found) revokeAttachmentUrl(found);
      return {
        items: state.items.filter((item) => item.id !== action.id),
        error: null,
      };
    }
    case "reset": {
      revokeAllAttachmentUrls(state.items);
      return INITIAL_ATTACHMENT_STATE;
    }
  }
};

// Drag-and-drop handlers. A depth counter tracks enter/leave so nested
// elements don't flicker the dragging state.
export type DragHandlerCallbacks = {
  isInScope: (event: DragEvent) => boolean;
  onFiles: (files: FileList) => void;
  setDragging: (active: boolean) => void;
};

export const createDragHandlers = (callbacks: DragHandlerCallbacks) => {
  const counter = { current: 0 };
  const carriesFiles = (event: DragEvent) => event.dataTransfer?.types?.includes("Files") ?? false;

  return {
    onDragOver: (event: Event) => {
      const dragEvent = event as DragEvent;
      if (!callbacks.isInScope(dragEvent)) return;
      if (carriesFiles(dragEvent)) dragEvent.preventDefault();
    },
    onDragEnter: (event: Event) => {
      const dragEvent = event as DragEvent;
      if (!callbacks.isInScope(dragEvent)) return;
      if (carriesFiles(dragEvent)) {
        counter.current++;
        callbacks.setDragging(true);
      }
    },
    onDragLeave: (event: Event) => {
      const dragEvent = event as DragEvent;
      if (!callbacks.isInScope(dragEvent)) return;
      counter.current--;
      if (counter.current === 0) callbacks.setDragging(false);
    },
    onDrop: (event: Event) => {
      const dragEvent = event as DragEvent;
      if (!callbacks.isInScope(dragEvent)) return;
      if (carriesFiles(dragEvent)) dragEvent.preventDefault();
      counter.current = 0;
      callbacks.setDragging(false);
      const files = dragEvent.dataTransfer?.files;
      if (files && files.length > 0) callbacks.onFiles(files);
    },
  };
};
