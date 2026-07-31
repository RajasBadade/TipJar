import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreatorCard } from "@/components/CreatorCard";
import type { CreatorProfile } from "@/lib/useCreators";

const WALLET = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";

function makeCreator(overrides: Partial<CreatorProfile> = {}): CreatorProfile {
  return {
    wallet: WALLET,
    name: "Ada Lovelace",
    bio: "Writes about analytical engines.",
    avatar: "",
    registeredAt: 1_700_000_000n,
    balance: 25_000_000n,
    ...overrides,
  };
}

describe("CreatorCard", () => {
  it("shows the creator's name, bio and balance in XLM", () => {
    render(<CreatorCard creator={makeCreator()} index={0} />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Writes about analytical engines.")).toBeInTheDocument();
    expect(screen.getByText("2.5 XLM")).toBeInTheDocument();
  });

  it("links to the creator's tip page", () => {
    render(<CreatorCard creator={makeCreator()} index={0} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", `/creator/${WALLET}`);
  });

  it("renders a 1-based, zero-padded rank", () => {
    render(<CreatorCard creator={makeCreator()} index={0} />);
    expect(screen.getByText("01")).toBeInTheDocument();
  });

  it("falls back to a short address when the name is empty", () => {
    render(<CreatorCard creator={makeCreator({ name: "" })} index={4} />);
    expect(screen.getByText("GBZXN7…MADI")).toBeInTheDocument();
  });

  it("shows placeholder copy when the creator has no bio", () => {
    render(<CreatorCard creator={makeCreator({ bio: "" })} index={0} />);
    expect(screen.getByText("No bio yet.")).toBeInTheDocument();
  });

  it("renders a zero balance without crashing", () => {
    render(<CreatorCard creator={makeCreator({ balance: 0n })} index={0} />);
    expect(screen.getByText("0 XLM")).toBeInTheDocument();
  });
});
