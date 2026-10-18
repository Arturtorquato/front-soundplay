export interface Track {
  id: number;
  titulo: string;
  duracao: number;
  url: string | null;
  artistaId: number | null;
  artistaNome: string | null;
  albumId: number | null;
  albumTitulo: string | null;
}

export interface Album {
  id: number;
  titulo: string;
  anoLancamento: number | null;
  capa: string | null;
  artistaId: number;
  artistaNome: string;
}

export interface Artist {
  id: number;
  nome: string;
  genero: string | null;
  biografia: string | null;
}

export interface Playlist {
  id: number;
  nome: string;
  descricao: string;
  publica: boolean;
  usuarioId: number;
  musicas: Track[];
}

export interface LoginResponse {
  token: string;
}

export interface RegisterRequest {
  nome: string;
  email: string;
  senha: string;
}

export interface PlaylistRequest {
  nome: string;
  descricao: string;
  publica: boolean;
}

export interface ArtistRequest {
  nome: string;
  genero: string | null;
  biografia: string | null;
}

export interface AlbumRequest {
  titulo: string;
  anoLancamento: number | null;
  capa: string | null;
  artistaId: number;
}

export interface TrackRequest {
  titulo: string;
  duracao: number;
  url: string | null;
  artistaId: number;
  albumId: number | null;
}
