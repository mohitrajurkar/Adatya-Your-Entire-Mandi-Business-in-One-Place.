// The logo is imported as a module so the bundler fingerprints it and emits it
// into the built assets. It was previously referenced by the literal path
// '/src/assets/images/adatya_logo_transparent.png', which only resolves under
// the Vite dev server: in every production build that URL fell through to the
// SPA fallback and returned index.html, so the logo was broken everywhere,
// including on the printed invoice.
import adatyaLogo from '../assets/images/adatya_logo_transparent.png';

export interface LogoOption {
  id: string;
  /**
   * Translation key for the display name. The previous `name` and `nameMr`
   * pair hard-coded both languages into the data and rendered them stacked,
   * so the label could not follow the trader's chosen language.
   */
  labelKey: 'official_brand_logo';
  src: string;
}

export const OFFICIAL_LOGO_SRC = adatyaLogo;
export const DEFAULT_LOGO = OFFICIAL_LOGO_SRC;

export const OFFICIAL_LOGO_DETAILS: LogoOption = {
  id: 'adatya-official-original',
  labelKey: 'official_brand_logo',
  src: OFFICIAL_LOGO_SRC,
};
