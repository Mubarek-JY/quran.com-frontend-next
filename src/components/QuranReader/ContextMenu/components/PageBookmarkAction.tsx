import React, { useCallback, useMemo, useState } from 'react';

import useTranslation from 'next-translate/useTranslation';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import styles from '../styles/ContextMenu.module.scss';

import Spinner from '@/components/dls/Spinner/Spinner';
import useGlobalReadingBookmark from '@/hooks/auth/useGlobalReadingBookmark';
import useMappedBookmark from '@/hooks/useMappedBookmark';
import BookmarkStarIcon from '@/icons/bookmark-star.svg';
import UnBookmarkedIcon from '@/icons/unbookmarked.svg';
import { selectGuestReadingBookmark, setGuestReadingBookmark } from '@/redux/slices/guestBookmark';
import { selectQuranReaderStyles } from '@/redux/slices/QuranReader/styles';
import BookmarkType from '@/types/BookmarkType';
import { getMushafId } from '@/utils/api';
import { deleteBookmarkById, setReadingBookmark } from '@/utils/auth/api';
import { isLoggedIn } from '@/utils/auth/login';
import { logButtonClick } from '@/utils/eventLogger';

interface PageBookmarkActionProps {
  pageNumber: number;
}

/**
 * Component for bookmarking a Quran page.
 * Directly toggles the single reading-position bookmark without opening a modal,
 * making navigation back to the last-read location a one-click action.
 *
 * @returns {JSX.Element} A React component that displays a bookmark icon for the current page
 */
const PageBookmarkAction: React.FC<PageBookmarkActionProps> = React.memo(({ pageNumber }) => {
  const guestReadingBookmark = useSelector(selectGuestReadingBookmark);
  const quranReaderStyles = useSelector(selectQuranReaderStyles, shallowEqual);
  const mushafId = getMushafId(quranReaderStyles.quranFont, quranReaderStyles.mushafLines).mushaf;
  const isGuest = !isLoggedIn();
  const dispatch = useDispatch();

  const { t } = useTranslation();

  const [isToggling, setIsToggling] = useState(false);

  // Use global reading bookmark hook for logged-in users
  const { readingBookmark, mutate, isLoading } = useGlobalReadingBookmark(mushafId);

  // Use the reusable mapping hook for cross-mushaf bookmark handling (guests only)
  const {
    needsMapping,
    effectivePageNumber,
    isLoading: isMappingLoading,
  } = useMappedBookmark({
    bookmark: isGuest ? guestReadingBookmark : null,
    swrKeyPrefix: 'map-bookmark-nav',
  });

  // Check if current page is the reading bookmark
  const isPageBookmarked = useMemo((): boolean => {
    if (isGuest) {
      // For guest, compare with effective (mapped) page number
      if (guestReadingBookmark?.type !== BookmarkType.Page) return false;
      // If mapping is still loading, treat as not bookmarked yet
      if (needsMapping && effectivePageNumber === null) return false;
      return effectivePageNumber === pageNumber;
    }

    // For logged-in users, check readingBookmark from global hook
    if (!readingBookmark) return false;

    return readingBookmark.type === BookmarkType.Page && readingBookmark.key === pageNumber;
  }, [
    isGuest,
    guestReadingBookmark,
    needsMapping,
    effectivePageNumber,
    readingBookmark,
    pageNumber,
  ]);

  const onBookmarkClicked = useCallback(async (): Promise<void> => {
    if (isToggling) return;

    logButtonClick('context_menu_page_bookmark_toggle');
    setIsToggling(true);

    try {
      if (isPageBookmarked) {
        // Remove the reading bookmark
        if (isGuest) {
          dispatch(setGuestReadingBookmark(null));
        } else if (readingBookmark && 'id' in readingBookmark) {
          await deleteBookmarkById(readingBookmark.id);
          await mutate(null, { revalidate: false });
        }
      } else {
        // Set this page as the reading bookmark
        if (isGuest) {
          dispatch(
            setGuestReadingBookmark({
              key: pageNumber,
              type: BookmarkType.Page,
              mushafId,
              createdAt: new Date().toISOString(),
            }),
          );
        } else {
          const savedBookmark = await setReadingBookmark(pageNumber, mushafId, BookmarkType.Page);
          await mutate(savedBookmark, { revalidate: false });
        }
      }
    } catch {
      // Silently ignore errors; the UI will naturally reflect the correct server state
      // on the next revalidation since we do not apply optimistic updates here.
    } finally {
      setIsToggling(false);
    }
  }, [isToggling, isPageBookmarked, isGuest, readingBookmark, pageNumber, mushafId, dispatch, mutate]);

  const isLoadingAny = isLoading || isMappingLoading || isToggling;

  let bookmarkIcon = <Spinner />;
  if (!isLoadingAny) {
    bookmarkIcon = isPageBookmarked ? (
      <BookmarkStarIcon className={styles.bookmarkedIcon} />
    ) : (
      <UnBookmarkedIcon className={styles.unbookmarkedIcon} />
    );
  }

  return (
    <button
      type="button"
      className={styles.bookmarkButton}
      onClick={onBookmarkClicked}
      disabled={isLoadingAny}
      aria-label={
        isPageBookmarked ? t('quran-reader:remove-bookmark') : t('quran-reader:add-bookmark')
      }
    >
      {bookmarkIcon}
    </button>
  );
});

export default PageBookmarkAction;
