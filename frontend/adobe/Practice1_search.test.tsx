import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchPracticeRoot from "./Practice1_search";

jest.useFakeTimers();

describe("SearchPracticeRoot", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;
  });

  it("renders input and focuses it", () => {
    render(<SearchPracticeRoot />);
    const input = screen.getByLabelText("Search");
    expect(input).toBeInTheDocument();
    expect(document.activeElement).toBe(input);
  });

  it("debounces API calls by 300ms", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: "1", label: "Adobe" }] }),
    });

    render(<SearchPracticeRoot />);
    const input = screen.getByLabelText("Search");

    await userEvent.type(input, "ado");

    expect(fetchMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(299);
    expect(fetchMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("shows loading and then results", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { id: "2", label: "Photoshop" },
          { id: "1", label: "Acrobat" },
        ],
      }),
    });

    render(<SearchPracticeRoot />);
    const input = screen.getByLabelText("Search");

    fireEvent.change(input, { target: { value: "adobe" } });
    jest.advanceTimersByTime(300);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByLabelText("search-results")).toBeInTheDocument());
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Acrobat");
    expect(rows[1]).toHaveTextContent("Photoshop");
  });

  it("shows error state", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ results: [] }),
    });

    render(<SearchPracticeRoot />);
    const input = screen.getByLabelText("Search");

    await userEvent.type(input, "broken");
    jest.advanceTimersByTime(300);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("clears results for empty input", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: "1", label: "Illustrator" }] }),
    });

    render(<SearchPracticeRoot />);
    const input = screen.getByLabelText("Search");

    await userEvent.type(input, "illu");
    jest.advanceTimersByTime(300);
    await waitFor(() => expect(screen.getByLabelText("search-results")).toBeInTheDocument());

    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => expect(screen.queryByLabelText("search-results")).not.toBeInTheDocument());
  });
});

