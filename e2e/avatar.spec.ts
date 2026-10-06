import { test, expect, type Locator, type Page } from '@playwright/test';
import { describeAppearance } from '../apps/web/src/features/avatar/appearance.js';
import {
  SKIN_TONE_OPTIONS,
  HAIR_STYLE_OPTIONS,
  HAIR_COLOR_OPTIONS,
  TOP_OPTIONS,
  BOTTOM_OPTIONS,
  SHOES_OPTIONS,
} from '../apps/web/src/features/avatar/catalog.js';

type Appearance = Parameters<typeof describeAppearance>[0];
type Field = keyof Appearance;

test.skip(!!process.env['CI'], 'needs local Supabase + Redis');

const PASSWORD = 'e2e-password-123';

// The creator's fieldsets, in page order
const GROUPS: ReadonlyArray<{ legend: string; field: Field }> = [
  { legend: 'Skin tone', field: 'skin_tone' },
  { legend: 'Hair style', field: 'hair_style' },
  { legend: 'Hair color', field: 'hair_color' },
  { legend: 'Top', field: 'top' },
  { legend: 'Bottom', field: 'bottom' },
  { legend: 'Shoes', field: 'shoes' },
];

// Every field differs from DEFAULT_APPEARANCE (the first value of each enum).
// Red hair next to the default red tee is why radio lookups are scoped to their group.
const chosen: Appearance = {
  skin_tone: 'tone-4',
  hair_style: 'curly',
  hair_color: 'red',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-black',
  shoes: 'starter-shoes-red',
};

function optionLabel(appearance: Appearance, field: Field): string {
  switch (field) {
    case 'skin_tone':
      return SKIN_TONE_OPTIONS[appearance.skin_tone].label;
    case 'hair_style':
      return HAIR_STYLE_OPTIONS[appearance.hair_style].label;
    case 'hair_color':
      return HAIR_COLOR_OPTIONS[appearance.hair_color].label;
    case 'top':
      return TOP_OPTIONS[appearance.top].label;
    case 'bottom':
      return BOTTOM_OPTIONS[appearance.bottom].label;
    case 'shoes':
      return SHOES_OPTIONS[appearance.shoes].label;
  }
}

function radio(page: Page, legend: string, name: string): Locator {
  return page.getByRole('group', { name: legend }).getByRole('radio', { name, exact: true });
}

async function expectRoom(page: Page, appearance: Appearance): Promise<void> {
  // data-ready is set once every sheet has loaded and the first frame is drawn
  await expect(page.locator('canvas[data-ready="true"]')).toHaveAccessibleName(
    describeAppearance(appearance),
    { timeout: 15_000 },
  );
  await expect(page).toHaveURL(/#\/$/);
}

test('a new player creates an avatar, reloads the room and edits the avatar', async ({ page }) => {
  test.slow();
  // The local database persists between runs, so every run signs up a new address
  const email = `e2e-${Date.now()}@example.test`;

  await page.goto('/');
  await page.getByRole('button', { name: "Don't have an account? Sign up" }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create Account' }).click();

  // No avatar yet: RoomPage sends the new player to the creator
  await expect(page).toHaveURL(/#\/create$/, { timeout: 15_000 });

  const recorded: Record<Field, string> = {
    skin_tone: '',
    hair_style: '',
    hair_color: '',
    top: '',
    bottom: '',
    shoes: '',
  };
  for (const { legend, field } of GROUPS) {
    const option = radio(page, legend, optionLabel(chosen, field));
    await option.check();
    recorded[field] = await option.inputValue();
  }
  expect(recorded).toEqual(chosen);

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expectRoom(page, chosen);

  // A reload refetches the saved avatar and stays in the room
  await page.reload();
  await expectRoom(page, chosen);

  // Edit mode is prefilled with the saved appearance
  await page.getByRole('link', { name: 'Edit avatar', exact: true }).click();
  await expect(page).toHaveURL(/#\/create$/);
  for (const { legend, field } of GROUPS) {
    await expect(
      page.getByRole('group', { name: legend }).getByRole('radio', { checked: true }),
    ).toHaveValue(recorded[field]);
  }

  // Changing one field and saving goes through the update path
  const updated: Appearance = { ...chosen, hair_color: 'blonde' };
  await radio(page, 'Hair color', optionLabel(updated, 'hair_color')).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expectRoom(page, updated);

  // The mirror in the room opens the creator too
  await page.getByRole('link', { name: 'Mirror: edit avatar' }).click();
  await expect(page).toHaveURL(/#\/create$/);
  await page.goBack();
  await expectRoom(page, updated);

  await page.reload();
  await expectRoom(page, updated);
});
