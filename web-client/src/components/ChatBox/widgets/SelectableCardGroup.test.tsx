import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SelectableCardGroup } from "./SelectableCardGroup";

afterEach(cleanup);

const items = [
  {
    id: "flight-1",
    label: "Delta DL100",
    node: (selected: boolean, onClick: () => void) => (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        data-testid="card-flight-1"
      >
        Flight 1 {selected ? "(selected)" : ""}
      </button>
    ),
  },
  {
    id: "flight-2",
    label: "United UA200",
    node: (selected: boolean, onClick: () => void) => (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        data-testid="card-flight-2"
      >
        Flight 2 {selected ? "(selected)" : ""}
      </button>
    ),
  },
];

describe("SelectableCardGroup", () => {
  it("renders all items", () => {
    render(<SelectableCardGroup items={items} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("card-flight-1")).toBeInTheDocument();
    expect(screen.getByTestId("card-flight-2")).toBeInTheDocument();
  });

  it("does not show confirm button initially", () => {
    render(<SelectableCardGroup items={items} onConfirm={vi.fn()} />);
    expect(screen.queryByText("Confirm Selection")).not.toBeInTheDocument();
  });

  it("shows confirm button after selecting an item", async () => {
    render(<SelectableCardGroup items={items} onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByTestId("card-flight-1"));
    expect(screen.getByText("Confirm Selection")).toBeInTheDocument();
  });

  it("calls onConfirm with the selected label when confirmed", async () => {
    const onConfirm = vi.fn();
    render(<SelectableCardGroup items={items} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByTestId("card-flight-1"));
    await userEvent.click(screen.getByText("Confirm Selection"));
    expect(onConfirm).toHaveBeenCalledWith("Delta DL100");
  });

  it("toggles selection off when clicking same item twice", async () => {
    render(<SelectableCardGroup items={items} onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByTestId("card-flight-1"));
    expect(screen.getByText("Confirm Selection")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("card-flight-1"));
    expect(screen.queryByText("Confirm Selection")).not.toBeInTheDocument();
  });

  it("shows confirmed state with checkmark when confirmedId is set", () => {
    render(
      <SelectableCardGroup
        items={items}
        onConfirm={vi.fn()}
        confirmedId="flight-1"
      />,
    );
    expect(screen.getByText(/Delta DL100/)).toBeInTheDocument();
    expect(screen.queryByText("Confirm Selection")).not.toBeInTheDocument();
  });

  it("ignores clicks when disabled", async () => {
    const onConfirm = vi.fn();
    render(
      <SelectableCardGroup items={items} onConfirm={onConfirm} disabled />,
    );
    await userEvent.click(screen.getByTestId("card-flight-1"));
    expect(screen.queryByText("Confirm Selection")).not.toBeInTheDocument();
  });

  it("ignores clicks when already confirmed", async () => {
    const onConfirm = vi.fn();
    render(
      <SelectableCardGroup
        items={items}
        onConfirm={onConfirm}
        confirmedId="flight-1"
      />,
    );
    await userEvent.click(screen.getByTestId("card-flight-2"));
    // Should still show confirmed state for flight-1, not switch
    expect(screen.getByText(/Delta DL100/)).toBeInTheDocument();
  });
});
