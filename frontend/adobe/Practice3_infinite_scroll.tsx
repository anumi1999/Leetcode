import React, { useCallback, useEffect, useRef, useState } from "react";

type Item = {
  id: number;
  title: string;
};

type PageResponse = {
  items: Item[];
  hasMore: boolean;
};

const PAGE_SIZE = 20;

async function fetchItems(page: number, pageSize: number): Promise<PageResponse> {
  const response = await fetch(`/api/items?page=${page}&pageSize=${pageSize}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch page ${page}`);
  }
  return (await response.json()) as PageResponse;
}

const Practice3InfiniteScroll: React.FC = () => {
  const [page, setPage] = useState<number>(0);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef<boolean>(false);
  const hasMoreRef = useRef<boolean>(true);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) {
      return;
    }

    const nextPage = page + 1;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchItems(nextPage, PAGE_SIZE);
      setItems((prevItems: Item[]) => [...prevItems, ...data.items]);
      setPage(nextPage);
      setHasMore(data.hasMore);
      hasMoreRef.current = data.hasMore;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadNextPage();
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (!firstEntry || !firstEntry.isIntersecting) return;
        void loadNextPage();
      },
      {
        root: null,
        rootMargin: "120px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [loadNextPage]);

  return (
    <section>
      <h2>Infinite Scroll Practice</h2>

      <ul>
        {items.map((item: Item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>

      {error && <p role="alert">{error}</p>}
      {loading && <p>Loading more...</p>}
      {!hasMore && !loading && <p>No more items.</p>}

      <div ref={sentinelRef} aria-label="scroll-sentinel" style={{ height: 1 }} />
    </section>
  );
};

export default Practice3InfiniteScroll;
