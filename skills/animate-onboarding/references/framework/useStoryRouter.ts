import { useRouter } from "superwall/navigation";
import { HANDOFF, IMAGE, type Route } from "../flow";
import { handoffMode, runHandoff, type HandoffName } from "./handoffs";
import { isImageReady, whenImageReady } from "./imageReady";

/**
 * The router, wrapped so every navigation runs inside its hand-off: the
 * chosen answer and the bar are measured before the page swaps, the swap
 * happens synchronously inside the hand-off, and the destination is measured
 * right after. A morph into a page with an image first waits (briefly) for
 * that image to be decoded; a newer tap during the wait wins.
 */
const IMAGE_WAIT_MS = 400;
let token = 0;

export function useStoryRouter() {
  const router = useRouter();

  const go = (direction: "next" | "back", route: Exclude<Route, "index">, apply: () => void) => {
    const mine = ++token;
    const name: HandoffName = handoffMode() === "plain" ? "plain" : HANDOFF[route];
    const run = () => {
      if (mine !== token) return;
      runHandoff({ handoff: name, direction, update: apply });
    };
    // Going back, the destination is the page we came from, whose image is already on screen.
    const image = direction === "next" ? IMAGE[route] : undefined;
    if (name === "plain" || !image || isImageReady(image)) return run();
    void whenImageReady(image, IMAGE_WAIT_MS).then(run);
  };

  return {
    /** Forward to `route`, by the hand-off that page declares. */
    push: (route: Exclude<Route, "index">) =>
      go("next", route, () =>
        router.push(route, { transition: handoffMode() === "plain" ? "fade" : `story-${HANDOFF[route]}` }),
      ),
    /** Back one page, reversing the hand-off the current page arrived by. */
    back: () => {
      if (!router.canGoBack()) return;
      const current = router.name as Route;
      if (current === "index") return router.back();
      go("back", current, () => router.back());
    },
  };
}
