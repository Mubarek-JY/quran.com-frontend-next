import React, { useCallback, useMemo, useState } from 'react';

import useTranslation from 'next-translate/useTranslation';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import styles from '../styles/ContextMenu.module.scss';

import Spinner from '@/components/dls/Spinner/Spinner';
import useGlobalReadingBookmark from '@/hooks/auth/useGlobalReadingBookmark';
import BookmarkStarIcon from '@/icons/bookmark-star.svg';
import UnBookmarkedIcon from '@/icons/unbookmarked.svg';
import { selectGuestReadingBookmark, setGuestReadingBookmark } from '@/redux/slices/guestBookmark';
import { selectQuranReaderStyles } from '@/redux/slices/QuranReader/styles';
import BookmarkType from '@/types/BookmarkType';
import Verse from '@/types/Verse';
import { getMushafId } from '@/utils/api';
import { deleteBookmarkById, setReadingBookmark } from '@/utils/auth/api';
import { isLoggedIn } from '@/utils/auth/login';
import { logButtonClick } from '@/utils/eventLogger';

interface VerseBookmarkActionProps {
  verse: Verse;
}

/**
 * Component for bookmarking a Quran verse.
 * Directly toggles the single reading-position bookmark without opening a modal,
 * making navigation back to the last-read location a one-click action.
 *
 * @returns {JSX.Element} A React component that displays a bookmark icon for the current verse
 */
const VerseBookmarkAction: React.FC<VerseBookmarkActionProps> = React.memo(({ verse }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const quranReaderStyles = useSelector(selectQuranReaderStyles, shallowEqual);
  const mushafId = getMushafId(quranReaderStyles.quranFont, quranReaderStyles.mushafLines).mushaf;
  const guestReadingBookmark = useSelector(selectGuestReadingBookmark);
  const isGuest = !isLoggedIn();

  const [isToggling, setIsToggling] = useState(false);

  const { readingBookmark, mutate, isLoading } = useGlobalReadingBookmark(mushafId);

  const isVerseReadingBookmark = useMemo((): boolean => {
    if (isGuest) {
      if (guestReadingBookmark?.type !== BookmarkType.Ayah) return false;
      return (
        guestReadingBookmark.key === Number(verse.chapterId) &&
        guestReadingBookmark.verseNumber === Number(verse.verseNumber)
      );
    }
    if (!readingBookmark || readingBookmark.type !== BookmarkType.Ayah) return false;
    return (
      readingBookmark.key === Number(verse.chapterId) &&
      readingBookmark.verseNumber === Number(verse.verseNumber)
    );
  }, [isGuest, guestReadingBookmark, readingBookmark, verse.chapterId, verse.verseNumber]);

  const onBookmarkClicked = useCallback(async (): Promise<void> => {
    if (isToggling) return;

    logButtonClick('context_menu_verse_bookmark_toggle');
    setIsToggling(true);

    try {
      if (isVerseReadingBookmark) {
        // Remove the reading bookmark
        if (isGuest) {
          dispatch(setGuestReadingBookmark(null));
        } else if (readingBookmark && 'id' in readingBookmark) {
          await deleteBookmarkById(readingBookmark.id);
          await mutate(null, { revalidate: false });
        }
      } else {
        // Set this verse as the reading bookmark
        const chapterId = Number(verse.chapterId);
        const verseNumber = Number(verse.verseNumber);
        if (isGuest) {
          dispatch(
            setGuestReadingBookmark({
              key: chapterId,
              type: BookmarkType.Ayah,
              verseNumber,
              mushafId,
              createdAt: new Date().toISOString(),
            }),
          );
        } else {
          const savedBookmark = await setReadingBookmark(
            chapterId,
            mushafId,
            BookmarkType.Ayah,
            verseNumber,
          );
          await mutate(savedBookmark, { revalidate: false });
        }
      }
    } catch {
      // Silently ignore errors; the UI will naturally reflect the correct server state
      // on the next revalidation since we do not apply optimistic updates here.
    } finally {
      setIsToggling(false);
    }
  }, [
    isToggling,
    isVerseReadingBookmark,
    isGuest,
    readingBookmark,
    verse.chapterId,
    verse.verseNumber,
    mushafId,
    dispatch,
    mutate,
  ]);

  const isLoadingAny = isLoading || isToggling;

  let bookmarkIcon = <Spinner />;
  if (!isLoadingAny) {
    bookmarkIcon = isVerseReadingBookmark ? (
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
        isVerseReadingBookmark ? t('quran-reader:remove-bookmark') : t('quran-reader:add-bookmark')
      }
    >
      {bookmarkIcon}
    </button>
  );
});

export default VerseBookmarkAction;
