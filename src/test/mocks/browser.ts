import { vi } from 'vitest';

// Mock window matchMedia
export const mockMatchMedia = () => {
  const matches = vi.fn(() => false);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matches(),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

// Mock IntersectionObserver
export const mockIntersectionObserver = () => {
  const intersectionObserverMock = vi.fn(
    () =>
      ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        root: null,
        rootMargin: '',
        thresholds: [],
        takeRecords: vi.fn(() => []),
      }) as IntersectionObserver,
  );
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: intersectionObserverMock,
  });
};

// Mock ResizeObserver
export const mockResizeObserver = () => {
  const resizeObserverMock = vi.fn(
    () =>
      ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }) as ResizeObserver,
  );
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: resizeObserverMock,
  });
};

export const setupCommonMocks = () => {
  mockMatchMedia();
  mockIntersectionObserver();
  mockResizeObserver();
};
