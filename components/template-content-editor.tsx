"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type DragEvent,
  type KeyboardEvent,
  type ClipboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import { templateVariableStyle } from "@/components/template-variable-text";
import {
  normalizeTemplateVariable,
  splitMessageTemplate,
  type TemplateVariable,
} from "@/lib/message-templates";
import { cn } from "@/lib/utils";

export const TEMPLATE_VARIABLE_MIME = "application/x-template-variable";
const TEMPLATE_VARIABLE_MOVE_MIME = "application/x-template-variable-move";
const TOKEN_AT_CARET_PATTERN = /\[[^[\]\r\n]{1,50}\]$/;

export type TemplateContentEditorHandle = {
  insertVariable: (variable: TemplateVariable) => void;
  focus: () => void;
};

type DocumentWithCaret = Document & {
  caretPositionFromPoint?: (
    x: number,
    y: number
  ) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

function caretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as DocumentWithCaret;
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    if (!position) return null;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }
  return doc.caretRangeFromPoint?.(x, y) ?? null;
}

function wordBoundaryOffsets(text: string): number[] {
  const offsets = new Set<number>([0, text.length]);
  let previousWordEnd: number | null = null;
  for (const match of text.matchAll(/\S+/g)) {
    if (previousWordEnd !== null && match.index > previousWordEnd) {
      offsets.add(Math.round((previousWordEnd + match.index) / 2));
    }
    previousWordEnd = match.index + match[0].length;
  }
  return [...offsets];
}

function snapToWordBoundary(range: Range, x: number, y: number): Range {
  const node = range.startContainer;
  const text = node.nodeType === Node.TEXT_NODE ? node.textContent : null;
  if (!text) return range;

  const length = text.length;
  if (length === 0) return range;

  const measureBoundary = (offset: number) => {
    const probe = document.createRange();
    if (offset < length) {
      probe.setStart(node, offset);
      probe.setEnd(node, offset + 1);
    } else {
      probe.setStart(node, length - 1);
      probe.setEnd(node, length);
    }
    const rect = probe.getBoundingClientRect();
    if (rect.height === 0 && rect.width === 0) return null;
    return {
      left: offset < length ? rect.left : rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
  };

  let bestOffset = range.startOffset;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const offset of wordBoundaryOffsets(text)) {
    const rect = measureBoundary(offset);
    if (!rect) continue;
    const vertical =
      y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    const distance = Math.abs(rect.left - x) + vertical * 50;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestOffset = offset;
    }
  }

  const snapped = document.createRange();
  snapped.setStart(node, bestOffset);
  snapped.collapse(true);
  return snapped;
}

function dropRangeFromPoint(x: number, y: number): Range | null {
  const range = caretRangeFromPoint(x, y);
  if (!range) return null;

  const node = range.startContainer;
  const host =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement;
  const chip = host?.closest<HTMLElement>("[data-variable-key]");
  if (chip) {
    const rect = chip.getBoundingClientRect();
    const adjusted = document.createRange();
    if (x > rect.left + rect.width / 2) {
      adjusted.setStartAfter(chip);
    } else {
      adjusted.setStartBefore(chip);
    }
    adjusted.collapse(true);
    return adjusted;
  }

  return snapToWordBoundary(range, x, y);
}

function createChipElement(variable: TemplateVariable) {
  const chip = document.createElement("span");
  chip.contentEditable = "false";
  chip.draggable = true;
  chip.dataset.variableKey = variable.key;
  chip.dataset.variableLabel = variable.label;
  chip.className = cn(
    "mx-0.5 inline-flex cursor-grab items-center rounded-md border px-1.5 py-0.5 align-baseline text-[0.8em] font-medium whitespace-nowrap select-none transition-transform active:scale-[0.97] active:cursor-grabbing",
    templateVariableStyle(variable.key).token
  );
  chip.textContent = variable.label;
  return chip;
}

function isVariableChip(node: Node) {
  return node.nodeType === Node.ELEMENT_NODE &&
    Boolean((node as HTMLElement).dataset.variableKey);
}

function contentSibling(node: Node, direction: "previous" | "next") {
  let sibling =
    direction === "previous" ? node.previousSibling : node.nextSibling;
  while (sibling) {
    if (
      isVariableChip(sibling) ||
      sibling instanceof HTMLBRElement ||
      (sibling.textContent ?? "").length > 0
    ) {
      return sibling;
    }
    sibling =
      direction === "previous" ? sibling.previousSibling : sibling.nextSibling;
  }
  return null;
}

function edgeCharacter(node: Node | null, edge: "start" | "end") {
  if (!node) return "";
  if (isVariableChip(node)) return "a";
  if (node instanceof HTMLBRElement) return "\n";
  const text = node.textContent ?? "";
  return edge === "start" ? text[0] ?? "" : text.at(-1) ?? "";
}

function addSemanticSpacing(chip: HTMLElement) {
  const previous = contentSibling(chip, "previous");
  const next = contentSibling(chip, "next");
  const previousCharacter = edgeCharacter(previous, "end");
  const nextCharacter = edgeCharacter(next, "start");

  if (previousCharacter && !/[\s([{\u00bf\u00a1\u00ab\u201c]/u.test(previousCharacter)) {
    chip.before(document.createTextNode(" "));
  }
  if (nextCharacter && !/[\s)\]},.!?;:\u00bb\u201d]/u.test(nextCharacter)) {
    chip.after(document.createTextNode(" "));
  }
}

function normalizeGapAfterChipRemoval(previous: Node | null, next: Node | null) {
  const previousCharacter = edgeCharacter(previous, "end");
  const nextCharacter = edgeCharacter(next, "start");
  if (!previousCharacter || !nextCharacter) return;

  const previousIsHorizontalSpace = /[^\S\r\n]/u.test(previousCharacter);
  const nextIsHorizontalSpace = /[^\S\r\n]/u.test(nextCharacter);
  if (
    previousIsHorizontalSpace &&
    nextIsHorizontalSpace &&
    next?.nodeType === Node.TEXT_NODE
  ) {
    (next as Text).deleteData(0, 1);
    return;
  }

  if (/\p{L}|\p{N}/u.test(previousCharacter) && /\p{L}|\p{N}/u.test(nextCharacter)) {
    next?.parentNode?.insertBefore(document.createTextNode(" "), next);
  }
}

function serializeNode(node: Node, isFirst: boolean): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  if (element.dataset.variableKey) {
    return `[${element.dataset.variableLabel || element.dataset.variableKey}]`;
  }
  if (element instanceof HTMLBRElement) return "\n";
  if (element instanceof HTMLDivElement || element instanceof HTMLParagraphElement) {
    const children = [...element.childNodes]
      .map((child) => serializeNode(child, isFirst))
      .join("");
    return `${isFirst ? "" : "\n"}${children}`;
  }
  return [...element.childNodes]
    .map((child) => serializeNode(child, isFirst))
    .join("");
}

function serializeEditor(editor: HTMLElement): string {
  let result = "";
  let index = 0;
  for (const node of editor.childNodes) {
    const element = node as HTMLElement;
    if (index > 0 && element.tagName === "DIV") result += "\n";
    result += serializeNode(node, index === 0);
    index += 1;
  }
  return result;
}

export function TemplateContentEditor({
  value,
  onChange,
  variables,
  maxLength = 5000,
  placeholder,
  className,
  handleRef,
}: {
  value: string;
  onChange: (content: string) => void;
  variables: TemplateVariable[];
  maxLength?: number;
  placeholder?: string;
  className?: string;
  handleRef: RefObject<TemplateContentEditorHandle | null>;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const draggedChipRef = useRef<HTMLElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);

  const renderContent = useCallback((content: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const fragment = document.createDocumentFragment();
    for (const part of splitMessageTemplate(content)) {
      if (part.type === "text") {
        fragment.appendChild(document.createTextNode(part.value));
      } else {
        fragment.appendChild(createChipElement(part));
      }
    }
    editor.replaceChildren(fragment);
  }, []);

  useEffect(() => {
    renderContent(valueRef.current);
  }, [renderContent]);

  const selectRange = useCallback((range: Range) => {
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const placeCaretAfterChip = useCallback(
    (chip: HTMLElement) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      const range = document.createRange();
      const next = chip.nextSibling;
      if (
        next?.nodeType === Node.TEXT_NODE &&
        /^[^\S\r\n]/u.test(next.textContent ?? "")
      ) {
        range.setStart(next, 1);
      } else {
        range.setStartAfter(chip);
      }
      range.collapse(true);
      selectRange(range);
    },
    [selectRange]
  );

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = serializeEditor(editor);
    if (next.length > maxLength) {
      renderContent(valueRef.current);
      return;
    }
    if (!next && editor.firstChild) editor.replaceChildren();
    valueRef.current = next;
    onChange(next);
  }, [maxLength, onChange, renderContent]);

  const insertChip = useCallback(
    (variable: TemplateVariable, range?: Range) => {
      const editor = editorRef.current;
      if (!editor) return;
      if (valueRef.current.length + variable.label.length + 2 > maxLength) return;

      editor.focus();
      let targetRange = range;
      if (!targetRange) {
        const selection = window.getSelection();
        const current =
          selection && selection.rangeCount > 0
            ? selection.getRangeAt(0)
            : null;
        if (current && editor.contains(current.startContainer)) {
          current.deleteContents();
          targetRange = current;
        } else {
          targetRange = document.createRange();
          targetRange.selectNodeContents(editor);
          targetRange.collapse(false);
        }
      }

      const chip = createChipElement(variable);
      targetRange.insertNode(chip);
      addSemanticSpacing(chip);
      placeCaretAfterChip(chip);
      emitChange();
    },
    [emitChange, maxLength, placeCaretAfterChip]
  );

  useImperativeHandle(handleRef, () => ({
    insertVariable: (variable) => insertChip(variable),
    focus: () => editorRef.current?.focus(),
  }));

  const removeIndicator = useCallback(() => {
    indicatorRef.current?.remove();
    indicatorRef.current = null;
  }, []);

  const convertTokenAtCaret = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (
      !editor ||
      !selection ||
      selection.rangeCount === 0 ||
      !selection.isCollapsed
    ) {
      return;
    }
    const node = selection.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE || !editor.contains(node)) {
      return;
    }

    const text = node.textContent ?? "";
    const offset = selection.anchorOffset;
    const match = text.slice(0, offset).match(TOKEN_AT_CARET_PATTERN);
    if (!match) return;

    const label = match[0].slice(1, -1).trim().replace(/\s+/g, " ");
    if (!label) return;

    const range = document.createRange();
    range.setStart(node, offset - match[0].length);
    range.setEnd(node, offset);
    range.deleteContents();

    const chip = createChipElement({
      key: normalizeTemplateVariable(label),
      label,
    });
    range.insertNode(chip);
    addSemanticSpacing(chip);
    placeCaretAfterChip(chip);
  }, [placeCaretAfterChip]);

  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    const inputType = (event.nativeEvent as InputEvent).inputType;
    if (!inputType || inputType.startsWith("insert")) {
      convertTokenAtCaret();
    }
    emitChange();
  };

  const positionIndicator = useCallback(
    (x: number, y: number) => {
      const editor = editorRef.current;
      if (!editor) return;
      const range = dropRangeFromPoint(x, y);
      if (!range) return;

      let indicator = indicatorRef.current;
      if (!indicator) {
        indicator = document.createElement("span");
        indicator.setAttribute("aria-hidden", "true");
        indicator.className =
          "mx-px inline-block h-[1.1em] w-0.5 rounded-full bg-brand align-text-bottom";
        indicatorRef.current = indicator;
      }
      indicator.remove();
      range.insertNode(indicator);
    },
    []
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const inserted = document.execCommand("insertText", false, "\n");
    if (!inserted) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode("\n"));
        range.collapse(false);
        selectRange(range);
      }
    }
    emitChange();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;

    const hasTokens = /\[[^[\]\r\n]{1,50}\]/.test(text);
    if (!hasTokens && !text.includes("\n")) {
      if (document.execCommand("insertText", false, text)) {
        emitChange();
        return;
      }
    }

    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer)) {
      range.selectNodeContents(editor);
      range.collapse(false);
    } else {
      range.deleteContents();
    }

    const fragment = document.createDocumentFragment();
    for (const part of splitMessageTemplate(text)) {
      if (part.type === "text") {
        fragment.appendChild(document.createTextNode(part.value));
      } else {
        fragment.appendChild(createChipElement(part));
      }
    }
    range.insertNode(fragment);
    selection.collapseToEnd();
    emitChange();
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const chip = target.closest<HTMLElement>("[data-variable-key]");
    if (!chip || !editorRef.current?.contains(chip)) return;
    draggedChipRef.current = chip;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(TEMPLATE_VARIABLE_MIME, chip.dataset.variableKey ?? "");
    event.dataTransfer.setData(TEMPLATE_VARIABLE_MOVE_MIME, "1");
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(TEMPLATE_VARIABLE_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = draggedChipRef.current ? "move" : "copy";
    positionIndicator(event.clientX, event.clientY);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      editorRef.current?.contains(event.relatedTarget)
    ) {
      return;
    }
    removeIndicator();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    removeIndicator();

    const editor = editorRef.current;
    if (!editor) return;

    const draggedChip = draggedChipRef.current;
    draggedChipRef.current = null;

    const range = dropRangeFromPoint(event.clientX, event.clientY);
    if (!range) return;

    if (draggedChip && editor.contains(draggedChip)) {
      const boundary =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer.parentElement;
      if (boundary && (boundary === draggedChip || draggedChip.contains(boundary))) {
        placeCaretAfterChip(draggedChip);
        return;
      }

      const marker = document.createComment("template-variable-drop");
      range.insertNode(marker);
      const previous = contentSibling(draggedChip, "previous");
      const next = contentSibling(draggedChip, "next");
      draggedChip.remove();
      normalizeGapAfterChipRemoval(previous, next);

      const destination = document.createRange();
      destination.setStartBefore(marker);
      destination.collapse(true);
      destination.insertNode(draggedChip);
      marker.remove();
      addSemanticSpacing(draggedChip);
      placeCaretAfterChip(draggedChip);
      emitChange();
      return;
    }

    const key = event.dataTransfer.getData(TEMPLATE_VARIABLE_MIME);
    const variable = variables.find((item) => item.key === key);
    if (variable) insertChip(variable, range);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const chip = target.closest<HTMLElement>("[data-variable-key]");
    if (chip && editorRef.current?.contains(chip)) {
      event.preventDefault();
      placeCaretAfterChip(chip);
    }
  };

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder}
      data-placeholder={placeholder}
      spellCheck
      className={cn(
        "template-editor-input size-full min-h-80 whitespace-pre-wrap break-words bg-transparent px-3 py-3 text-sm leading-6 text-foreground caret-foreground outline-none",
        className
      )}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={() => {
        draggedChipRef.current = null;
        removeIndicator();
      }}
      onClick={handleClick}
    />
  );
}
