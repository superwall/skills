import { useEffect, type PropsWithChildren } from "react";
import { useActions, useHaptics, useTranslation } from "superwall/hooks";
import { useRouter } from "superwall/navigation";
import { IMAGE, PROGRESS, type Route } from "../components/flow";
import { warmImage } from "../components/motion/imageReady";
import { useStoryRouter } from "../components/motion/useStoryRouter";
import "./theme.css";
import "./motion.css";

/**
 * The shared chrome: back button, progress bar, close. It lives here, mounted
 * for the whole flow, which is what lets a chosen answer fly INTO the bar: the
 * bar survives every navigation. The motion layer at the end is where the
 * engine pins every travelling copy (position: absolute over the content box,
 * never fixed).
 */
export default function Layout({ children }: PropsWithChildren) {
  const router = useRouter();
  const story = useStoryRouter();
  const { close } = useActions();
  const { t } = useTranslation();
  const haptics = useHaptics();
  const route = router.name as Route;
  const fraction = PROGRESS[route];

  // Decode every image the flow shows as soon as it opens, so a morph into one never measures a
  // zero-height target (Safari loads even a cached image asynchronously).
  useEffect(() => {
    for (const src of Object.values(IMAGE)) if (src) void warmImage(src);
  }, []);

  return (
    <div className="shell" data-route={route} data-tone={route === "statement" ? "inverse" : undefined}>
      <header className="chrome">
        {router.canGoBack() && route !== "done" ? (
          <button
            type="button"
            className="chrome-button"
            data-back-button=""
            aria-label={t("common.back")}
            onClick={() => {
              haptics.light();
              story.back();
            }}
          >
            <svg viewBox="0 0 16 16" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>
        ) : (
          <span className="chrome-button" aria-hidden="true" />
        )}

        <div data-progress="" className={`progress${route === "index" || route === "done" ? " progress--hidden" : ""}`} aria-hidden="true">
          <div className="progress-track">
            <div data-progress-fill="" data-progress={fraction} className="progress-fill" style={{ transform: `translateX(${(fraction - 1) * 100}%)` }} />
          </div>
        </div>

        <button
          type="button"
          className="chrome-button"
          data-close-button=""
          aria-label={t("common.close")}
          onClick={() => {
            haptics.light();
            close();
          }}
        >
          <svg viewBox="0 0 16 16" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4 12 12M12 4 4 12" />
          </svg>
        </button>
      </header>

      {children}

      <div data-motion-layer="" className="motion-layer" aria-hidden="true" />
    </div>
  );
}
