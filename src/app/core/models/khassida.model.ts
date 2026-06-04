export interface KhassidaInfo {
  id: string;
  nom: string;
  nomAr?: string;
  auteur: string;
  metrique: string;
  nb_vers: number;
  xaab_per_vers: number;
  pdfUrl: string;
  disponible: boolean;
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

export interface KhassidaDetail {
  id: string;
  nb_vers: number;
  audio_vers: number;
  xaab_per_vers: number;
  has_tardjuman: boolean;
  has_cloture: boolean;
  pdfMapping: PdfMapping;
  repeats: VersRepeat[];
  segments: Segment[];
}
