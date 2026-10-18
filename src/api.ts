import type {
  Album,
  AlbumRequest,
  Artist,
  ArtistRequest,
  LoginResponse,
  Playlist,
  PlaylistRequest,
  RegisterRequest,
  Track,
  TrackRequest,
} from './types';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'soundplay-token';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      `Não foi possível conectar à API (${API_URL}). Verifique se o backend está ativo.`,
      0,
    );
  }

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const payload: unknown = JSON.parse(text);
      if (payload && typeof payload === 'object') {
        const body = payload as Record<string, unknown>;
        const candidate = body.message ?? body.detail ?? body.error;
        if (typeof candidate === 'string') message = candidate;
      }
    } catch {
      if (!message) message = response.statusText;
    }

    throw new ApiError(
      message || `A API respondeu com erro ${response.status}.`,
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, senha: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    }),

  register: (data: RegisterRequest) =>
    request<{ nome: string; email: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTracks: () => request<Track[]>('/musicas'),
  getAlbums: () => request<Album[]>('/albuns'),
  getArtists: () => request<Artist[]>('/artistas'),
  getMyPlaylists: () => request<Playlist[]>('/playlists/minhas'),

  createTrack: (data: TrackRequest) =>
    request<Track>('/musicas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createAlbum: (data: AlbumRequest) =>
    request<Album>('/albuns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createArtist: (data: ArtistRequest) =>
    request<Artist>('/artistas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createPlaylist: (data: PlaylistRequest) =>
    request<Playlist>('/playlists', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addTrack: (playlistId: number, trackId: number) =>
    request<Playlist>(`/playlists/${playlistId}/musicas/${trackId}`, {
      method: 'POST',
    }),

  removeTrack: (playlistId: number, trackId: number) =>
    request<void>(`/playlists/${playlistId}/musicas/${trackId}`, {
      method: 'DELETE',
    }),

  deletePlaylist: (playlistId: number) =>
    request<void>(`/playlists/${playlistId}`, { method: 'DELETE' }),
};

export { TOKEN_KEY };
