import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

type SearchItem = {
  id: string;
  label: string;
};

type SearchResponse = {
  results: SearchItem[];
};

type SearchState = {
  loading: boolean;
  error: string | null;
  results: SearchItem[];
};

type SearchAction =
  | { type: "start" }
  | { type: "success"; payload: SearchItem[] }
  | { type: "error"; payload: string }
  | { type: "clear" };

const SearchConfigContext = React.createContext<{ debounceMs: number }>({
  debounceMs: 300,
});

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "start":
      return { ...state, loading: true, error: null };
    case "success":
      return { loading: false, error: null, results: action.payload };
    case "error":
      return { ...state, loading: false, error: action.payload };
    case "clear":
      return { loading: false, error: null, results: [] };
    default:
      return state;
  }
}

const initialState: SearchState = {
  loading: false,
  error: null,
  results: [],
};

const SearchResults = memo(function SearchResults({
  results,
}: {
  results: SearchItem[];
}) {
  return (
    <ul aria-label="search-results">
      {results.map((item) => (
        <li key={item.id}>{item.label}</li>
      ))}
    </ul>
  );
});

const SearchComponent: React.FC = () => {
  const { debounceMs } = useContext(SearchConfigContext);
  const [query, setQuery] = useState<string>("");
  const [state, dispatch] = useReducer(searchReducer, initialState);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const fetchResults = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "start" });
    try {
      const response = await fetch(`/results?query=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Error fetching results: ${response.status}`);
      }

      const data = (await response.json()) as SearchResponse;
      dispatch({ type: "success", payload: data.results ?? [] });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      dispatch({ type: "error", payload: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      abortRef.current?.abort();
      dispatch({ type: "clear" });
      return;
    }

    const timerId = window.setTimeout(() => {
      void fetchResults(trimmedQuery);
    }, debounceMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [query, debounceMs, fetchResults]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const sortedResults = useMemo(() => {
    return [...state.results].sort((a, b) => a.label.localeCompare(b.label));
  }, [state.results]);

  return (
    <section>
      <label htmlFor="search-input">Search</label>
      <input
        id="search-input"
        ref={inputRef}
        value={query}
        onChange={handleSearch}
        placeholder="Type to search..."
      />

      {state.loading && <p>Loading...</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {!state.loading && !state.error && query.trim() && sortedResults.length === 0 && (
        <p>No results found.</p>
      )}
      {!state.loading && !state.error && sortedResults.length > 0 && (
        <SearchResults results={sortedResults} />
      )}
    </section>
  );
};

export const SearchPracticeRoot: React.FC = () => {
  return (
    <SearchConfigContext.Provider value={{ debounceMs: 300 }}>
      <SearchComponent />
    </SearchConfigContext.Provider>
  );
};

export default SearchPracticeRoot;
