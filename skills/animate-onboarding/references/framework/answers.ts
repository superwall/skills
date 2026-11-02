import { parseAsStringEnum } from "superwall/hooks";

/**
 * Every answer is a user attribute, read and written with `useUserAttribute`,
 * so it outlives the page that asked and reaches Superwall the moment it is
 * given. Values are stable kebab-case so audiences built on them hold.
 */
export const STRUGGLE = {
  key: "sleep_struggle",
  parser: parseAsStringEnum(["racing", "waking", "schedule", "noise"]),
};
export const NIGHTS = {
  key: "bad_nights",
  parser: parseAsStringEnum(["one", "few", "most", "every"]),
};
export const TRIED = {
  key: "tried_before",
  parser: parseAsStringEnum(["nothing", "melatonin", "apps", "routine"]),
};
