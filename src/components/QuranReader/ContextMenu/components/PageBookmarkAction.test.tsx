import React from 'react';

import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import PageBookmarkAction from './PageBookmarkAction';

import BookmarkType from '@/types/BookmarkType';

const mockSetReadingBookmark = vi.fn().mockResolvedValue({ id: 'bk1', key: 1, type: BookmarkType.Page });
const mockDeleteBookmarkById = vi.fn().mockResolvedValue(undefined);
const mockDispatch = vi.fn();
const mockMutate = vi.fn().mockResolvedValue(undefined);

vi.mock('next-translate/useTranslation', () => ({ default: () => ({ t: (k: string) => k }) }));
vi.mock('swr', () => ({ default: () => ({ data: undefined, isValidating: false, mutate: vi.fn() }) }));
vi.mock('@/icons/bookmark-star.svg', () => ({ default: () => <div data-testid="star" /> }));
vi.mock('@/icons/unbookmarked.svg', () => ({ default: () => <div data-testid="unbookmarked" /> }));
vi.mock('@/utils/auth/login', () => ({ isLoggedIn: () => false }));
vi.mock('@/utils/auth/api', () => ({
  setReadingBookmark: (...args: unknown[]) => mockSetReadingBookmark(...args),
  deleteBookmarkById: (...args: unknown[]) => mockDeleteBookmarkById(...args),
}));
vi.mock('@/hooks/auth/useGlobalReadingBookmark', () => ({
  default: () => ({ readingBookmark: null, mutate: mockMutate, isLoading: false }),
}));
vi.mock('@/hooks/useMappedBookmark', () => ({
  default: ({ bookmark }: any) => ({
    needsMapping: false,
    effectivePageNumber: bookmark?.key || null,
    effectiveAyahVerseKey: null,
    isLoading: false,
  }),
}));
vi.mock('@/redux/slices/QuranReader/styles', () => ({
  selectQuranReaderStyles: (s: any) => s.quranReaderStyles,
}));
vi.mock('@/redux/slices/guestBookmark', () => ({
  selectGuestReadingBookmark: (s: any) => s.guestBookmark?.readingBookmark ?? null,
  setGuestReadingBookmark: vi.fn((payload) => ({ type: 'guestBookmark/setGuestReadingBookmark', payload })),
}));
vi.mock('react-redux', () => {
  const defaultState = {
    quranReaderStyles: { quranFont: 'hafs', mushafLines: 15 },
    guestBookmark: { readingBookmark: null },
  } as any;
  return {
    useSelector: (selector: (s: any) => any) =>
      selector((globalThis as any).mockPageState?.current || defaultState),
    useDispatch: () => mockDispatch,
    shallowEqual: () => null,
  };
});

describe('PageBookmarkAction', () => {
  it('shows remove aria-label and star icon when current page is bookmarked', async () => {
    (globalThis as any).mockPageState = {
      current: {
        quranReaderStyles: { quranFont: 'hafs', mushafLines: 15 },
        guestBookmark: {
          readingBookmark: {
            key: 1,
            type: BookmarkType.Page,
            mushafId: 1,
            createdAt: new Date().toISOString(),
          },
        },
      },
    };
    render(<PageBookmarkAction pageNumber={1} />);
    const button = await screen.findByRole('button', { name: 'quran-reader:remove-bookmark' });
    expect(button.getAttribute('aria-label')).toBe('quran-reader:remove-bookmark');
    expect(await screen.findByTestId('star')).toBeDefined();
  });

  it('shows add aria-label and unbookmarked icon when page not bookmarked', () => {
    cleanup();
    (globalThis as any).mockPageState = {
      current: {
        quranReaderStyles: { quranFont: 'hafs', mushafLines: 15 },
        guestBookmark: {
          readingBookmark: {
            key: 2,
            type: BookmarkType.Page,
            mushafId: 1,
            createdAt: new Date().toISOString(),
          },
        },
      },
    };
    render(<PageBookmarkAction pageNumber={1} />);
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('quran-reader:add-bookmark');
    expect(screen.getByTestId('unbookmarked')).toBeDefined();
  });

  it('dispatches setGuestReadingBookmark when guest clicks to set bookmark', async () => {
    cleanup();
    mockDispatch.mockClear();
    const { setGuestReadingBookmark } = await import('@/redux/slices/guestBookmark');
    (globalThis as any).mockPageState = {
      current: {
        quranReaderStyles: { quranFont: 'hafs', mushafLines: 15 },
        guestBookmark: { readingBookmark: null },
      },
    };
    render(<PageBookmarkAction pageNumber={5} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        setGuestReadingBookmark(
          expect.objectContaining({ key: 5, type: BookmarkType.Page }),
        ),
      );
    });
  });

  it('dispatches setGuestReadingBookmark(null) when guest clicks to remove bookmark', async () => {
    cleanup();
    mockDispatch.mockClear();
    const { setGuestReadingBookmark } = await import('@/redux/slices/guestBookmark');
    (globalThis as any).mockPageState = {
      current: {
        quranReaderStyles: { quranFont: 'hafs', mushafLines: 15 },
        guestBookmark: {
          readingBookmark: {
            key: 3,
            type: BookmarkType.Page,
            mushafId: 1,
            createdAt: new Date().toISOString(),
          },
        },
      },
    };
    render(<PageBookmarkAction pageNumber={3} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(setGuestReadingBookmark(null));
    });
  });
});
