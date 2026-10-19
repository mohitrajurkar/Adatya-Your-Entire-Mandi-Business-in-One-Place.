export interface LogoOption {
  id: string;
  name: string;
  nameMr: string;
  tagline: string;
  description: string;
  descriptionMr: string;
  src: string;
}

export const OFFICIAL_LOGO_SRC = '/src/assets/images/adatya_logo_transparent.png';
export const DEFAULT_LOGO = OFFICIAL_LOGO_SRC;

export const OFFICIAL_LOGO_DETAILS: LogoOption = {
  id: 'adatya-official-original',
  name: 'Official Adatya Emerald & Gold Logo (अधिकृत लोगो)',
  nameMr: 'आडत्या अधिकृत "A" सुवर्ण तराजू व ओंबी लोगो',
  tagline: 'Original Luxury Mandi Brand Emblem · Transparent Vector',
  description: 'Majestic serif letter "A" in deep emerald green framed with polished gold, featuring a central vertical golden wheat ear and twin balanced weighing scale pans (taraju). Transparent background seamlessly blends onto all bills and themes.',
  descriptionMr: 'सोन्याची बॉर्डर असलेले गडद हिरवे "A" अक्षर, मध्यभागी सुवर्ण धान्य ओंबी आणि दोन्ही बाजूला अचूक समतोल वजनकाट्याची पारडी (तराजू). पारदर्शक बॅकग्राउंड.',
  src: OFFICIAL_LOGO_SRC,
};

export const LOGO_OPTIONS: LogoOption[] = [OFFICIAL_LOGO_DETAILS];
