import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookingChauffeurCard } from "./booking-chauffeur-card";
import type { BookingView } from "./booking-domain";

function renderCard(
  booking: Pick<BookingView, "chauffeurName" | "chauffeurInitials" | "chauffeurImage">,
) {
  return renderToStaticMarkup(
    createElement(BookingChauffeurCard, { booking: booking as BookingView }),
  );
}

describe("booking chauffeur profile", () => {
  it("renders the avatar initials before the profile image loads", () => {
    const markup = renderCard({
      chauffeurName: "Bola Adebayo",
      chauffeurInitials: "BA",
      chauffeurImage: "/images/hero-640.webp",
    });

    expect(markup).toContain('data-slot="avatar"');
    expect(markup).toContain('data-slot="avatar-fallback"');
    expect(markup).toContain("BA");
    expect(markup).toContain("Bola Adebayo");
  });

  it("shows initials when no profile image is available", () => {
    const markup = renderCard({
      chauffeurName: "Not Assigned",
      chauffeurInitials: "NA",
      chauffeurImage: null,
    });

    expect(markup).not.toContain("<img");
    expect(markup).toContain('data-slot="avatar-fallback"');
    expect(markup).toContain("NA");
  });
});
