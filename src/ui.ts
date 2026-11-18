/** Tailwind classes shared by several screens. Tokens (colors, radius, fonts, sizes) live in styles.css. */

/** The title font (BBH Hegarty) at its only weight: never a faked bold. */
export const display = "font-display font-normal";

/** Blue card. */
export const card = "rounded-card bg-card p-4.5 text-on-card shadow-md";

/** Red square button with a white icon: form and Recipe actions, the add button. Square: never squeezed by a full-width field next to it. */
export const actionButton =
  "inline-grid size-11 flex-none place-items-center rounded-button bg-action p-0 text-on-card";

/** Icon button inside a blue card. */
export const cardIcon =
  "grid flex-none place-items-center bg-transparent p-0 text-on-card";

/** Close / save / edit / delete, top right of a form or a Recipe. */
export const screenActions = "mt-4 flex justify-end gap-1.5";

/** A list of cards. */
export const cardList = "m-0 mt-4.25 list-none p-0";

/** A form field on one line: its name, then the field. */
export const fieldInline = "flex items-center gap-3 text-30";

/** A Recipe's photo, or its empty square, in a card. */
export const photoThumb = "size-25 rounded-photo bg-on-card/15 object-cover";
