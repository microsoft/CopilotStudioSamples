export type ContentSizeHandler = (width: number, height: number) => void;

/** Reports content size changes so the host can resize the component frame. */
export function watchContentSize(element: HTMLElement, onSize: ContentSizeHandler): () => void {
  const view: (Window & typeof globalThis) | null = element.ownerDocument.defaultView;
  if (!view || typeof view.ResizeObserver !== 'function') {
    return () => undefined;
  }

  let lastWidth: number = -1;
  let lastHeight: number = -1;
  const observer: ResizeObserver = new view.ResizeObserver(() => {
    const rect: DOMRect = element.getBoundingClientRect();
    const width: number = Math.ceil(rect.width);
    const height: number = Math.ceil(rect.height);
    if (width !== lastWidth || height !== lastHeight) {
      lastWidth = width;
      lastHeight = height;
      onSize(width, height);
    }
  });

  observer.observe(element);
  return () => observer.disconnect();
}
