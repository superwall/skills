import { useEffect, useRef, useState } from "react";
import { useActions, useHaptics, useTranslation } from "superwall/hooks";
import { useIsFocused } from "superwall/navigation";
import type { Route } from "./flow";
import { answers } from "./answers";
import { Choice } from "./Choice";
import { useStoryRouter } from "./motion/useStoryRouter";

/**
 * A question with a stack of answers. A tap selects, the others step back for
 * a beat (`data-committing`) so the tap is visibly heard, the answer is sent
 * to Superwall as a user attribute, and the flow moves on by the next page's
 * hand-off. Coming back, the earlier answer is already selected: that is what
 * the bar hands back out, and what the user can change. The page stays mounted
 * behind the next one, so the commit lock is released when it regains focus.
 */
const COMMIT_MS = 140;

export function Question<K extends keyof typeof answers>({
  attribute,
  title,
  options,
  next,
}: {
  attribute: K;
  title: string;
  options: readonly { value: NonNullable<(typeof answers)[K]>; label: string }[];
  next: Exclude<Route, "index">;
}) {
  const story = useStoryRouter();
  const { setUserAttributes } = useActions();
  const { t } = useTranslation();
  const haptics = useHaptics();
  const [selected, setSelected] = useState<(typeof answers)[K]>(answers[attribute]);
  const [committing, setCommitting] = useState(false);
  const timer = useRef<number>(undefined);
  const focused = useIsFocused();

  useEffect(() => {
    if (focused) setCommitting(false);
  }, [focused]);

  const choose = (value: NonNullable<(typeof answers)[K]>) => {
    if (committing) return;
    haptics.selection();
    setSelected(value);
    setCommitting(true);
    answers[attribute] = value;
    setUserAttributes({ [attribute]: value });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => story.push(next), COMMIT_MS);
  };

  return (
    <main className="page" data-flow-page="">
      <div className="lede">
        <h1 data-flow-line="">{t(title)}</h1>
      </div>

      <div className="choices" role="radiogroup" aria-label={t(title)}>
        {options.map((option) => (
          <Choice
            key={option.value}
            selected={selected === option.value}
            committing={committing}
            onChoose={() => choose(option.value)}
          >
            {t(option.label)}
          </Choice>
        ))}
      </div>
    </main>
  );
}
