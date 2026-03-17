export const APP_NAME = 'Sakurajima';
export const APP_TAGLINE = 'A local-first desktop companion.';

export function createWelcomeHeading(version: string): string {
  return `${APP_NAME} v${version}`;
}

