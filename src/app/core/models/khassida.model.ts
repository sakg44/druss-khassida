/**
 * Daadj : style de sonorisation (terme wolof). Détermine quel jeu d'audio
 * est joué. L'`id` sert aussi de segment de dossier R2 :
 * `${r2BaseUrl}/${daadj.id}/${khassida.id}/{vers}_x{xaab}.mp3`.
 */
export interface Daadj {
  id: string;
  nom: string;
  nomAr?: string;
  /** Kurel (groupe) qui interprète ce daadj, ex. « Kurel 2 HT Dakar ». */
  kurel: string;
  /** Métadonnées facultatives de l'enregistrement. */
  annee?: number;
  evenement?: string; // ex. « J18 Ramadan »
}

/** Ligne de contexte d'un daadj : « J18 Ramadan · 2022 » (vide si rien). */
export function daadjContexte(d: Daadj): string {
  return [d.evenement, d.annee].filter(Boolean).join(' · ');
}

export interface KhassidaInfo {
  id: string;
  nom: string;
  nomAr?: string;
  auteur: string;
  metrique: string;
  metriqueAr?: string;
  nb_vers: number;
  xaab_per_vers: number;
  pdfUrl: string;
  disponible: boolean;
  /** Styles de sonorisation disponibles (au moins un). */
  daajs: Daadj[];
}

export interface KhassidaCatalog {
  r2BaseUrl: string;
  khassidas: KhassidaInfo[];
}

export interface PdfMapping {
  startPage: number;
  versPerPage: number;
}

export interface Segment {
  index: number;
  vers: number;
  xaab: number;
  start: number;
  end: number;
}

export interface VersRepeat {
  audioVers: number;
  originalVers: number;
}

export interface VersAnnotation {
  vers: number;
  page: number;
  yStart: number;  // 0–1 normalisé sur la hauteur de la page
  yEnd:   number;
}

export interface HighlightZone {
  page:   number;
  yStart: number;
  yEnd:   number;
}

export interface KhassidaDetail {
  id: string;
  nb_vers: number;
  audio_vers: number;
  xaab_per_vers: number;
  has_tardjuman: boolean;
  has_cloture: boolean;
  pdfMapping: PdfMapping;
  repeats: VersRepeat[];
  annotations?: VersAnnotation[];
  /** Hérité du temps où l'audio était un seul fichier. Optionnel : les mp3
   *  sont désormais pré-découpés (un fichier par vers/xaab). */
  segments?: Segment[];
}
