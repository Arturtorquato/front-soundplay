import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Album as AlbumIcon,
  ArrowDownToLine,
  AudioLines,
  ChevronDown,
  CircleHelp,
  Disc3,
  Heart,
  Home,
  ListMusic,
  LogOut,
  Music2,
  Play,
  Plus,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { api, ApiError, TOKEN_KEY } from './api';
import type { Album, Artist, Playlist, Track } from './types';

type Section = 'home' | 'search' | 'playlists' | 'artist';

const prettyDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
};

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [section, setSection] = useState<Section>('home');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [activeArtistId, setActiveArtistId] = useState<number | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<number | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPlaylistForm, setShowPlaylistForm] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState<Track | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setCatalogError('');

    Promise.allSettled([api.getTracks(), api.getAlbums(), api.getArtists(), api.getMyPlaylists()])
      .then(([trackResult, albumResult, artistResult, playlistResult]) => {
        if (cancelled) return;
        const failedResults = [trackResult, albumResult, artistResult, playlistResult]
          .filter((result) => result.status === 'rejected');
        if (failedResults.some((result) =>
          result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 401,
        )) {
          handleLogout();
          setNotice('Sua sessão expirou. Entre novamente.');
          return;
        }
        if (trackResult.status === 'fulfilled') setTracks(trackResult.value);
        else setCatalogError(getErrorMessage(trackResult.reason));

        if (albumResult.status === 'fulfilled') setAlbums(albumResult.value);
        else setNotice(`Não foi possível carregar os álbuns: ${getErrorMessage(albumResult.reason)}`);

        if (artistResult.status === 'fulfilled') {
          setArtists(artistResult.value);
          setActiveArtistId((current) => current ?? artistResult.value[0]?.id ?? null);
        } else {
          setNotice(`Não foi possível carregar os artistas: ${getErrorMessage(artistResult.reason)}`);
        }

        if (playlistResult.status === 'fulfilled') {
          setPlaylists(playlistResult.value);
          setActivePlaylistId((current) => current ?? playlistResult.value[0]?.id ?? null);
        } else {
          setNotice(`Não foi possível carregar suas playlists: ${getErrorMessage(playlistResult.reason)}`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (notice) {
      const timer = window.setTimeout(() => setNotice(''), 5000);
      return () => window.clearTimeout(timer);
    }
  }, [notice]);

  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) ?? null;
  const filteredTracks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    if (!normalizedQuery) return tracks;
    return tracks.filter((track) =>
      [track.titulo, track.artistaNome, track.albumTitulo]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('pt-BR').includes(normalizedQuery)),
    );
  }, [query, tracks]);

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setTracks([]);
    setAlbums([]);
    setArtists([]);
    setPlaylists([]);
    setCurrentTrack(null);
    setActivePlaylistId(null);
    setActiveArtistId(null);
  }

  function handleToken(nextToken: string) {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
  }

  function playTrack(track: Track) {
    if (!track.url) {
      setNotice('Esta música ainda não possui uma URL de reprodução cadastrada.');
      return;
    }
    setCurrentTrack(track);
  }

  function playNext(direction: -1 | 1) {
    if (!currentTrack || tracks.length === 0) return;
    const index = tracks.findIndex((track) => track.id === currentTrack.id);
    const next = tracks[(index + direction + tracks.length) % tracks.length];
    if (next) playTrack(next);
  }

  async function createPlaylist(nome: string, descricao: string, publica: boolean) {
    try {
      const playlist = await api.createPlaylist({ nome, descricao, publica });
      setPlaylists((current) => [playlist, ...current]);
      setActivePlaylistId(playlist.id);
      setSection('playlists');
      setShowPlaylistForm(false);
      setNotice('Playlist criada com sucesso.');
    } catch (error) {
      handleApiError(error);
    }
  }

  async function createArtist(nome: string, genero: string, biografia: string) {
    const artist = await api.createArtist({
      nome: nome.trim(),
      genero: genero.trim() || null,
      biografia: biografia.trim() || null,
    });
    setArtists((current) => [artist, ...current]);
    setActiveArtistId(artist.id);
    setNotice('Perfil de artista cadastrado.');
    return artist;
  }

  async function createAlbum(
    titulo: string,
    anoLancamento: string,
    capa: string,
    artistaId: number,
  ) {
    const album = await api.createAlbum({
      titulo: titulo.trim(),
      anoLancamento: anoLancamento ? Number(anoLancamento) : null,
      capa: capa.trim() || null,
      artistaId,
    });
    setAlbums((current) => [album, ...current]);
    setNotice('Álbum cadastrado com sucesso.');
    return album;
  }

  async function createTrack(
    titulo: string,
    duracao: number,
    url: string,
    artistaId: number,
    albumId: number | null,
  ) {
    const track = await api.createTrack({
      titulo: titulo.trim(),
      duracao,
      url: url.trim() || null,
      artistaId,
      albumId,
    });
    setTracks((current) => [track, ...current]);
    setNotice('Música cadastrada com sucesso.');
    return track;
  }

  async function addTrackToPlaylist(playlistId: number) {
    if (!trackToAdd) return;
    try {
      const updated = await api.addTrack(playlistId, trackToAdd.id);
      setPlaylists((current) => current.map((playlist) => playlist.id === updated.id ? updated : playlist));
      setTrackToAdd(null);
      setNotice('Música adicionada à playlist.');
    } catch (error) {
      handleApiError(error);
    }
  }

  async function removeTrackFromPlaylist(track: Track) {
    if (!activePlaylist) return;
    try {
      await api.removeTrack(activePlaylist.id, track.id);
      setPlaylists((current) => current.map((playlist) => playlist.id === activePlaylist.id
        ? { ...playlist, musicas: playlist.musicas.filter((item) => item.id !== track.id) }
        : playlist));
      setNotice('Música removida da playlist.');
    } catch (error) {
      handleApiError(error);
    }
  }

  async function removePlaylist(playlist: Playlist) {
    if (!window.confirm(`Excluir a playlist "${playlist.nome}"?`)) return;
    try {
      await api.deletePlaylist(playlist.id);
      const remaining = playlists.filter((item) => item.id !== playlist.id);
      setPlaylists(remaining);
      setActivePlaylistId(remaining[0]?.id ?? null);
      setNotice('Playlist excluída.');
    } catch (error) {
      handleApiError(error);
    }
  }

  function handleApiError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      handleLogout();
      setNotice('Sua sessão expirou. Entre novamente.');
      return;
    }
    setNotice(getErrorMessage(error));
  }

  if (!token) {
    return <AuthScreen onToken={handleToken} onError={(error) => setNotice(getErrorMessage(error))} notice={notice} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setSection('home'); }}>
          <span className="brand-mark"><AudioLines size={23} strokeWidth={2.5} /></span>
          <span>sound<span className="brand-light">play</span></span>
        </a>

        <nav className="primary-nav" aria-label="Navegação principal">
          <button className={section === 'home' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('home')}>
            <Home size={19} /> <span>Início</span>
          </button>
          <button className={section === 'search' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('search')}>
            <Search size={19} /> <span>Buscar</span>
          </button>
          <button className={section === 'playlists' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('playlists')}>
            <AlbumIcon size={19} /> <span>Sua biblioteca</span>
          </button>
          <button className={section === 'artist' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('artist')}>
            <Music2 size={19} /> <span>Área do artista</span>
          </button>
        </nav>

        <div className="sidebar-divider" />
        <div className="library-heading">
          <span>Suas playlists</span>
          <button className="icon-button small" aria-label="Criar playlist" onClick={() => setShowPlaylistForm(true)}>
            <Plus size={18} />
          </button>
        </div>
        <div className="sidebar-playlists">
          {playlists.length === 0 ? (
            <p className="sidebar-empty">Crie sua primeira playlist e reúna suas favoritas.</p>
          ) : playlists.map((playlist) => (
            <button
              key={playlist.id}
              className={activePlaylistId === playlist.id && section === 'playlists' ? 'playlist-link selected' : 'playlist-link'}
              onClick={() => { setActivePlaylistId(playlist.id); setSection('playlists'); }}
            >
              <span className="playlist-mini-icon"><ListMusic size={15} /></span>
              <span className="playlist-link-copy"><strong>{playlist.nome}</strong><small>{playlist.musicas.length} músicas</small></span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="profile-chip">
            <span className="avatar">S</span>
            <span><strong>Ouvinte</strong><small>Conta conectada</small></span>
            <button className="icon-button small logout" onClick={handleLogout} aria-label="Sair">
              <LogOut size={16} />
            </button>
          </div>
          <span className="version-note">Sua música. Seu momento.</span>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-search">
            <Search size={18} />
            <input
              aria-label="Buscar músicas, artistas e álbuns"
              placeholder="O que você quer ouvir?"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSection('search'); }}
              onFocus={() => setSection('search')}
            />
            {query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Limpar busca"><X size={15} /></button>}
          </div>
          <div className="topbar-actions">
            <span className="topbar-greeting">Olá, que bom ter você por aqui</span>
            <button className="profile-button" onClick={handleLogout} title="Sair da conta">
              <span className="avatar small-avatar">S</span><ChevronDown size={15} />
            </button>
          </div>
        </header>

        <div className="content-scroll">
          {notice && <div className="toast" role="status"><CircleHelp size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
          {catalogError && (
            <div className="error-banner" role="alert">
              <span>{catalogError}</span>
              <button onClick={() => window.location.reload()}>Tentar novamente</button>
            </div>
          )}

          {section === 'home' && (
            <HomeSection
              tracks={tracks}
              albums={albums}
              loading={loading}
              onPlay={playTrack}
              onAdd={setTrackToAdd}
              onBrowse={() => setSection('search')}
              onCreate={() => setShowPlaylistForm(true)}
            />
          )}
          {section === 'search' && (
            <SearchSection
              query={query}
              tracks={filteredTracks}
              albums={albums}
              loading={loading}
              onPlay={playTrack}
              onAdd={setTrackToAdd}
            />
          )}
          {section === 'playlists' && (
            <PlaylistSection
              playlists={playlists}
              activePlaylist={activePlaylist}
              loading={loading}
              onSelect={setActivePlaylistId}
              onCreate={() => setShowPlaylistForm(true)}
              onDelete={removePlaylist}
              onPlay={playTrack}
              onRemoveTrack={removeTrackFromPlaylist}
            />
          )}
          {section === 'artist' && (
            <ArtistStudio
              artists={artists}
              albums={albums}
              tracks={tracks}
              activeArtistId={activeArtistId}
              loading={loading}
              onSelectArtist={setActiveArtistId}
              onCreateArtist={createArtist}
              onCreateAlbum={createAlbum}
              onCreateTrack={createTrack}
              onError={handleApiError}
            />
          )}
        </div>
      </main>

      <footer className="player-bar">
        <div className="now-playing">
          {currentTrack ? (
            <>
              <div className="player-art"><Disc3 size={22} /></div>
              <div className="now-playing-copy"><strong>{currentTrack.titulo}</strong><span>{currentTrack.artistaNome || 'Artista desconhecido'}</span></div>
              <button className="icon-button player-like" aria-label="Adicionar às playlists" onClick={() => setTrackToAdd(currentTrack)}><Heart size={17} /></button>
            </>
          ) : (
            <>
              <div className="player-art muted-art"><Music2 size={20} /></div>
              <div className="now-playing-copy"><strong>Nada tocando ainda</strong><span>Escolha uma música para começar</span></div>
            </>
          )}
        </div>
        <div className="player-controls">
          <div className="player-buttons">
            <button className="icon-button" aria-label="Faixa anterior" disabled={!currentTrack} onClick={() => playNext(-1)}><SkipBack size={17} fill="currentColor" /></button>
            <button className="play-toggle" aria-label="Reproduzir música selecionada" disabled={!currentTrack} onClick={() => audioRef.current?.play()}><Play size={17} fill="currentColor" /></button>
            <button className="icon-button" aria-label="Próxima faixa" disabled={!currentTrack} onClick={() => playNext(1)}><SkipForward size={17} fill="currentColor" /></button>
          </div>
          <div className="audio-control">
            {currentTrack?.url ? (
              <audio
                ref={audioRef}
                key={currentTrack.id}
                controls
                autoPlay
                src={currentTrack.url}
                onError={() => setNotice('Não foi possível reproduzir esta URL. Verifique o endereço cadastrado na música.')}
              />
            ) : (
              <div className="audio-placeholder"><span>0:00</span><span className="progress-track"><i /></span><span>0:00</span></div>
            )}
          </div>
        </div>
        <div className="player-extra"><AudioLines size={19} /><span>{currentTrack ? prettyDuration(currentTrack.duracao) : 'SOUNDPLAY'}</span></div>
      </footer>

      {showPlaylistForm && <PlaylistModal onClose={() => setShowPlaylistForm(false)} onCreate={createPlaylist} />}
      {trackToAdd && !showPlaylistForm && (
        <AddToPlaylistModal
          track={trackToAdd}
          playlists={playlists}
          onClose={() => setTrackToAdd(null)}
          onCreate={() => setShowPlaylistForm(true)}
          onAdd={addTrackToPlaylist}
        />
      )}
    </div>
  );
}

function HomeSection({
  tracks, albums, loading, onPlay, onAdd, onBrowse, onCreate,
}: {
  tracks: Track[];
  albums: Album[];
  loading: boolean;
  onPlay: (track: Track) => void;
  onAdd: (track: Track) => void;
  onBrowse: () => void;
  onCreate: () => void;
}) {
  return (
    <section className="page-section">
      <div className="hero-panel">
        <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
        <div className="hero-content">
          <span className="eyebrow"><Sparkles size={14} /> SEU SOM, SUA IDENTIDADE</span>
          <h1>Sua trilha sonora,<br /><em>do seu jeito.</em></h1>
          <p>Descubra músicas, monte playlists e dê o play no que faz sentido para você.</p>
          <button className="primary-button hero-button" onClick={onBrowse}><Search size={17} /> Explorar músicas</button>
        </div>
        <div className="hero-record"><div className="record-label"><AudioLines size={34} /></div></div>
      </div>

      <div className="section-heading">
        <div><span className="eyebrow muted-eyebrow">FEITO PARA VOCÊ</span><h2>O som começa aqui</h2></div>
        <button className="text-button" onClick={onBrowse}>Ver catálogo <span>→</span></button>
      </div>
      {loading ? <LoadingState /> : tracks.length ? (
        <TrackList tracks={tracks.slice(0, 5)} onPlay={onPlay} onAdd={onAdd} />
      ) : <EmptyState title="Seu catálogo está esperando" text="Assim que houver músicas cadastradas na API, elas aparecem por aqui." />}

      <div className="section-heading album-heading">
        <div><span className="eyebrow muted-eyebrow">COLEÇÃO</span><h2>Álbuns em destaque</h2></div>
      </div>
      {loading ? <LoadingState /> : albums.length ? (
        <div className="album-grid">
          {albums.slice(0, 4).map((album) => <AlbumCard key={album.id} album={album} />)}
        </div>
      ) : <EmptyState title="Novos álbuns em breve" text="Os álbuns cadastrados serão exibidos aqui." />}

      <div className="create-playlist-promo">
        <div className="promo-icon"><ListMusic size={23} /></div>
        <div><strong>Uma vibe só sua</strong><span>Crie uma playlist para cada momento.</span></div>
        <button className="outline-button" onClick={onCreate}><Plus size={16} /> Criar playlist</button>
      </div>
    </section>
  );
}

function SearchSection({
  query, tracks, albums, loading, onPlay, onAdd,
}: {
  query: string;
  tracks: Track[];
  albums: Album[];
  loading: boolean;
  onPlay: (track: Track) => void;
  onAdd: (track: Track) => void;
}) {
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const matchingAlbums = albums.filter((album) => !normalized || [album.titulo, album.artistaNome]
    .some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized)));
  return (
    <section className="page-section">
      <div className="page-title">
        <span className="eyebrow muted-eyebrow">EXPLORE O CATÁLOGO</span>
        <h1>{query ? <>Resultados para <em>“{query}”</em></> : 'Buscar música'}</h1>
        <p>Encontre uma música, revisite um álbum ou descubra o que combina com você.</p>
      </div>
      {loading ? <LoadingState /> : (
        <>
          <div className="section-heading compact-heading"><div><h2>Músicas <span className="count-label">{tracks.length}</span></h2></div></div>
          {tracks.length ? <TrackList tracks={tracks} onPlay={onPlay} onAdd={onAdd} /> : <EmptyState title={query ? 'Nenhuma música encontrada' : 'Nenhuma música no catálogo'} text={query ? 'Tente buscar por outro título, artista ou álbum.' : 'As músicas cadastradas na API vão aparecer aqui.'} />}
          {matchingAlbums.length > 0 && (
            <>
              <div className="section-heading album-heading compact-heading"><div><h2>Álbuns</h2></div></div>
              <div className="album-grid">
                {matchingAlbums.slice(0, 8).map((album) => <AlbumCard key={album.id} album={album} />)}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function PlaylistSection({
  playlists, activePlaylist, loading, onSelect, onCreate, onDelete, onPlay, onRemoveTrack,
}: {
  playlists: Playlist[];
  activePlaylist: Playlist | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDelete: (playlist: Playlist) => void;
  onPlay: (track: Track) => void;
  onRemoveTrack: (track: Track) => void;
}) {
  if (loading) return <section className="page-section"><LoadingState /></section>;
  if (playlists.length === 0) {
    return (
      <section className="page-section">
        <div className="page-title"><span className="eyebrow muted-eyebrow">SUA BIBLIOTECA</span><h1>Suas <em>playlists</em></h1><p>Guarde as músicas que combinam com cada parte do seu dia.</p></div>
        <div className="empty-library"><div className="empty-disc"><ListMusic size={32} /></div><h2>Um espaço todo seu</h2><p>Crie sua primeira playlist e comece a montar a trilha sonora dos seus momentos.</p><button className="primary-button" onClick={onCreate}><Plus size={17} /> Criar minha playlist</button></div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-title">
        <span className="eyebrow muted-eyebrow">SUA BIBLIOTECA</span>
        <h1>Suas <em>playlists</em></h1>
        <p>Selecione uma coleção para ver e ouvir suas músicas.</p>
      </div>
      <div className="playlist-tabs">
        {playlists.map((playlist) => (
          <button key={playlist.id} className={activePlaylist?.id === playlist.id ? 'playlist-tab active-tab' : 'playlist-tab'} onClick={() => onSelect(playlist.id)}>
            <ListMusic size={15} /> {playlist.nome}
          </button>
        ))}
        <button className="playlist-tab add-tab" onClick={onCreate}><Plus size={16} /> Nova playlist</button>
      </div>
      {activePlaylist && (
        <div className="playlist-detail">
          <div className="playlist-cover"><AudioLines size={41} /></div>
          <div className="playlist-detail-copy">
            <span className="eyebrow muted-eyebrow">{activePlaylist.publica ? 'PLAYLIST PÚBLICA' : 'PLAYLIST PRIVADA'}</span>
            <h2>{activePlaylist.nome}</h2>
            <p>{activePlaylist.descricao || 'Uma coleção feita por você.'}</p>
            <span className="playlist-meta">{activePlaylist.musicas.length} {activePlaylist.musicas.length === 1 ? 'música' : 'músicas'}</span>
          </div>
          <button className="icon-button delete-playlist" onClick={() => onDelete(activePlaylist)} aria-label="Excluir playlist" title="Excluir playlist"><Trash2 size={18} /></button>
        </div>
      )}
      {activePlaylist?.musicas.length ? (
        <TrackList tracks={activePlaylist.musicas} onPlay={onPlay} onRemove={onRemoveTrack} />
      ) : <EmptyState title="Essa playlist está vazia" text="Busque suas músicas favoritas e adicione-as a esta playlist." />}
    </section>
  );
}

function ArtistStudio({
  artists,
  albums,
  tracks,
  activeArtistId,
  loading,
  onSelectArtist,
  onCreateArtist,
  onCreateAlbum,
  onCreateTrack,
  onError,
}: {
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  activeArtistId: number | null;
  loading: boolean;
  onSelectArtist: (id: number) => void;
  onCreateArtist: (nome: string, genero: string, biografia: string) => Promise<Artist>;
  onCreateAlbum: (titulo: string, anoLancamento: string, capa: string, artistaId: number) => Promise<Album>;
  onCreateTrack: (titulo: string, duracao: number, url: string, artistaId: number, albumId: number | null) => Promise<Track>;
  onError: (error: unknown) => void;
}) {
  const [form, setForm] = useState<'track' | 'album' | 'artist'>('track');
  const [busy, setBusy] = useState(false);
  const selectedArtist = artists.find((artist) => artist.id === activeArtistId) ?? null;
  const artistAlbums = albums.filter((album) => album.artistaId === activeArtistId);
  const artistTracks = tracks.filter((track) => track.artistaId === activeArtistId);

  async function submitArtist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await onCreateArtist(
        String(data.get('artistName') || ''),
        String(data.get('artistGenre') || ''),
        String(data.get('artistBio') || ''),
      );
      formElement.reset();
      setForm('track');
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  async function submitAlbum(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeArtistId) return;
    const formElement = event.currentTarget;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await onCreateAlbum(
        String(data.get('albumTitle') || ''),
        String(data.get('albumYear') || ''),
        String(data.get('albumCover') || ''),
        activeArtistId,
      );
      formElement.reset();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  async function submitTrack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeArtistId) return;
    const formElement = event.currentTarget;
    const data = new FormData(event.currentTarget);
    const albumValue = String(data.get('trackAlbum') || '');
    setBusy(true);
    try {
      await onCreateTrack(
        String(data.get('trackTitle') || ''),
        Number(data.get('trackDuration')),
        String(data.get('trackUrl') || ''),
        activeArtistId,
        albumValue ? Number(albumValue) : null,
      );
      formElement.reset();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section">
      <div className="artist-studio-hero">
        <div className="studio-hero-icon"><AudioLines size={26} /></div>
        <span className="eyebrow">SUA MÚSICA TAMBÉM TEM ESPAÇO</span>
        <h1>Área do <em>artista</em></h1>
        <p>Cadastre um perfil, publique seus álbuns e compartilhe suas músicas no catálogo Soundplay.</p>
        {artists.length > 0 && (
          <label className="artist-selector">
            <span>Perfil selecionado</span>
            <select value={activeArtistId ?? ''} onChange={(event) => onSelectArtist(Number(event.target.value))}>
              {artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.nome}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="studio-tabs" role="tablist" aria-label="Cadastro de conteúdo">
        <button role="tab" aria-selected={form === 'track'} className={form === 'track' ? 'studio-tab selected' : 'studio-tab'} onClick={() => setForm('track')}><Music2 size={16} /> Música</button>
        <button role="tab" aria-selected={form === 'album'} className={form === 'album' ? 'studio-tab selected' : 'studio-tab'} onClick={() => setForm('album')}><Disc3 size={16} /> Álbum</button>
        <button role="tab" aria-selected={form === 'artist'} className={form === 'artist' ? 'studio-tab selected' : 'studio-tab'} onClick={() => setForm('artist')}><AudioLines size={16} /> Perfil de artista</button>
      </div>

      <div className="studio-layout">
        <div className="studio-form-panel">
          {form === 'artist' && (
            <form className="studio-form" onSubmit={submitArtist}>
              <div><span className="eyebrow muted-eyebrow">COMECE POR AQUI</span><h2>Criar perfil de artista</h2><p>Cadastre o nome que aparecerá nos seus álbuns e músicas.</p></div>
              <label>Nome do artista<input name="artistName" required maxLength={150} placeholder="Nome artístico ou banda" /></label>
              <label>Gênero musical <span className="optional-label">opcional</span><input name="artistGenre" maxLength={50} placeholder="Ex.: MPB, rock, eletrônico" /></label>
              <label>Biografia <span className="optional-label">opcional</span><textarea name="artistBio" rows={4} placeholder="Conte um pouco sobre o artista" /></label>
              <button className="primary-button studio-submit" disabled={busy}>{busy ? <span className="spinner dark-spinner" /> : <><Plus size={16} /> Cadastrar artista</>}</button>
            </form>
          )}

          {form === 'album' && (
            selectedArtist ? (
              <form className="studio-form" onSubmit={submitAlbum}>
                <div><span className="eyebrow muted-eyebrow">NOVO LANÇAMENTO</span><h2>Cadastrar álbum</h2><p>O álbum será associado ao perfil <strong>{selectedArtist.nome}</strong>.</p></div>
                <label>Título do álbum<input name="albumTitle" required maxLength={200} placeholder="Nome do álbum" /></label>
                <label>Ano de lançamento <span className="optional-label">opcional</span><input name="albumYear" type="number" min="1000" max="9999" step="1" placeholder="2026" /></label>
                <label>URL da capa <span className="optional-label">opcional</span><input name="albumCover" type="url" maxLength={500} placeholder="https://exemplo.com/capa.jpg" /></label>
                <button className="primary-button studio-submit" disabled={busy}>{busy ? <span className="spinner dark-spinner" /> : <><Plus size={16} /> Cadastrar álbum</>}</button>
              </form>
            ) : <StudioNeedsArtist onCreate={() => setForm('artist')} />
          )}

          {form === 'track' && (
            selectedArtist ? (
              <form className="studio-form" onSubmit={submitTrack}>
                <div><span className="eyebrow muted-eyebrow">NOVA FAIXA</span><h2>Cadastrar música</h2><p>A faixa será publicada no catálogo como <strong>{selectedArtist.nome}</strong>.</p></div>
                <label>Título da música<input name="trackTitle" required maxLength={150} placeholder="Nome da música" /></label>
                <div className="studio-field-row">
                  <label>Duração <span className="field-hint">em segundos</span><input name="trackDuration" type="number" required min="1" step="1" placeholder="210" /></label>
                  <label>Álbum <span className="optional-label">opcional</span><select name="trackAlbum" defaultValue=""><option value="">Single (sem álbum)</option>{artistAlbums.map((album) => <option key={album.id} value={album.id}>{album.titulo}</option>)}</select></label>
                </div>
                <label>URL do áudio <span className="optional-label">opcional</span><input name="trackUrl" type="url" maxLength={500} placeholder="https://exemplo.com/musica.mp3" /><small className="field-hint">Informe uma URL de áudio acessível para habilitar a reprodução no player.</small></label>
                <button className="primary-button studio-submit" disabled={busy}>{busy ? <span className="spinner dark-spinner" /> : <><Plus size={16} /> Cadastrar música</>}</button>
              </form>
            ) : <StudioNeedsArtist onCreate={() => setForm('artist')} />
          )}
        </div>

        <aside className="studio-catalog">
          {loading ? <LoadingState /> : selectedArtist ? (
            <>
              <div className="studio-profile-card">
                <span className="studio-profile-avatar"><AudioLines size={21} /></span>
                <span><strong>{selectedArtist.nome}</strong><small>{selectedArtist.genero || 'Artista Soundplay'}</small></span>
              </div>
              <div className="studio-catalog-section">
                <div className="studio-catalog-heading"><strong>Álbuns</strong><span>{artistAlbums.length}</span></div>
                {artistAlbums.length ? artistAlbums.map((album) => (
                  <div className="studio-item" key={album.id}>
                    <span className="studio-item-icon"><Disc3 size={15} /></span>
                    <span><strong>{album.titulo}</strong><small>{album.anoLancamento || 'Ano não informado'}</small></span>
                  </div>
                )) : <p className="studio-empty">Seus álbuns cadastrados aparecem aqui.</p>}
              </div>
              <div className="studio-catalog-section">
                <div className="studio-catalog-heading"><strong>Músicas</strong><span>{artistTracks.length}</span></div>
                {artistTracks.length ? artistTracks.map((track) => (
                  <div className="studio-item" key={track.id}>
                    <span className="studio-item-icon"><Music2 size={15} /></span>
                    <span><strong>{track.titulo}</strong><small>{track.albumTitulo || 'Single'} · {prettyDuration(track.duracao)}</small></span>
                  </div>
                )) : <p className="studio-empty">Suas músicas cadastradas aparecem aqui.</p>}
              </div>
            </>
          ) : (
            <div className="studio-catalog-empty"><div className="empty-disc"><AudioLines size={28} /></div><strong>Seu espaço de artista</strong><p>Crie um perfil para começar a cadastrar álbuns e músicas.</p></div>
          )}
        </aside>
      </div>

      <p className="studio-api-note">O catálogo é compartilhado entre usuários autenticados pela API atual; ela ainda não associa cada perfil ou lançamento à conta que o cadastrou.</p>
    </section>
  );
}

function StudioNeedsArtist({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="studio-needs-artist">
      <span className="empty-icon"><AudioLines size={21} /></span>
      <h2>Crie primeiro um perfil de artista</h2>
      <p>Álbuns e músicas precisam estar vinculados a um artista no catálogo.</p>
      <button className="primary-button" onClick={onCreate}><Plus size={16} /> Cadastrar artista</button>
    </div>
  );
}

function TrackList({
  tracks, onPlay, onAdd, onRemove,
}: {
  tracks: Track[];
  onPlay: (track: Track) => void;
  onAdd?: (track: Track) => void;
  onRemove?: (track: Track) => void;
}) {
  return (
    <div className="track-list">
      <div className="track-header"><span>#</span><span>Título</span><span className="track-album-header">Álbum</span><span className="duration-heading">Duração</span><span /></div>
      {tracks.map((track, index) => (
        <div className="track-row" key={track.id}>
          <span className="track-index"><span>{String(index + 1).padStart(2, '0')}</span><button className="row-play" onClick={() => onPlay(track)} aria-label={`Reproduzir ${track.titulo}`}><Play size={14} fill="currentColor" /></button></span>
          <button className="track-main" onClick={() => onPlay(track)}>
            <span className="track-art"><Music2 size={17} /></span>
            <span className="track-copy"><strong>{track.titulo}</strong><small>{track.artistaNome || 'Artista desconhecido'}</small></span>
          </button>
          <span className="track-album">{track.albumTitulo || 'Single'}</span>
          <span className="track-duration">{prettyDuration(track.duracao)}</span>
          <span className="track-actions">
            {onAdd && <button className="icon-button row-action" aria-label={`Adicionar ${track.titulo} a uma playlist`} onClick={() => onAdd(track)}><Plus size={17} /></button>}
            {onRemove && <button className="icon-button row-action remove-action" aria-label={`Remover ${track.titulo} da playlist`} onClick={() => onRemove(track)}><X size={16} /></button>}
          </span>
        </div>
      ))}
    </div>
  );
}

function AlbumCard({ album }: { album: Album }) {
  return (
    <article className="album-card">
      <div className="album-art">
        {album.capa ? <img src={album.capa} alt={`Capa do álbum ${album.titulo}`} loading="lazy" /> : <Disc3 size={36} />}
        <span className="album-play"><Play size={17} fill="currentColor" /></span>
      </div>
      <strong>{album.titulo}</strong>
      <span>{album.artistaNome}{album.anoLancamento ? ` · ${album.anoLancamento}` : ''}</span>
    </article>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span className="empty-icon"><Music2 size={21} /></span><div><strong>{title}</strong><p>{text}</p></div></div>;
}

function LoadingState() {
  return <div className="loading-state"><span className="spinner" />Carregando sua música...</div>;
}

function PlaylistModal({
  onClose, onCreate,
}: {
  onClose: () => void;
  onCreate: (nome: string, descricao: string, publica: boolean) => void;
}) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [publica, setPublica] = useState(true);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modal-card" onSubmit={(event) => { event.preventDefault(); onCreate(nome.trim(), descricao.trim(), publica); }}>
        <button type="button" className="modal-close icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button>
        <span className="eyebrow muted-eyebrow">NOVA COLEÇÃO</span><h2>Criar playlist</h2>
        <p>Um lugar para reunir músicas que combinam entre si.</p>
        <label>Nome da playlist<input autoFocus required maxLength={150} value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Ex.: Fim de tarde" /></label>
        <label>Descrição<textarea required value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Qual é a vibe desta playlist?" rows={3} /></label>
        <label className="switch-row"><span><strong>Playlist pública</strong><small>Outras pessoas podem descobrir sua coleção.</small></span><input type="checkbox" checked={publica} onChange={(event) => setPublica(event.target.checked)} /></label>
        <button className="primary-button modal-submit" type="submit"><Plus size={17} /> Criar playlist</button>
      </form>
    </div>
  );
}

function AddToPlaylistModal({
  track, playlists, onClose, onCreate, onAdd,
}: {
  track: Track;
  playlists: Playlist[];
  onClose: () => void;
  onCreate: () => void;
  onAdd: (playlistId: number) => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-card add-modal">
        <button className="modal-close icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button>
        <span className="eyebrow muted-eyebrow">ADICIONAR MÚSICA</span><h2>Escolha uma playlist</h2>
        <p><strong>{track.titulo}</strong> · {track.artistaNome || 'Artista desconhecido'}</p>
        <div className="playlist-picker">
          {playlists.map((playlist) => (
            <button key={playlist.id} onClick={() => onAdd(playlist.id)}>
              <span className="playlist-mini-icon"><ListMusic size={17} /></span>
              <span><strong>{playlist.nome}</strong><small>{playlist.musicas.length} músicas</small></span>
              <Plus size={17} />
            </button>
          ))}
          {!playlists.length && <span className="picker-empty">Você ainda não tem playlists.</span>}
        </div>
        <button className="outline-button full-button" onClick={onCreate}><Plus size={16} /> Criar nova playlist</button>
      </div>
    </div>
  );
}

function AuthScreen({
  onToken, onError, notice,
}: {
  onToken: (token: string) => void;
  onError: (error: unknown) => void;
  notice: string;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') {
        await api.register({ nome: name.trim(), email: email.trim(), senha: password });
      }
      const result = await api.login(email.trim(), password);
      onToken(result.token);
    } catch (caught) {
      const message = getErrorMessage(caught);
      setError(mode === 'register' && caught instanceof ApiError && caught.status === 409
        ? 'Este e-mail já possui uma conta. Entre para continuar.'
        : message);
      onError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-visual">
        <div className="auth-brand"><span className="brand-mark"><AudioLines size={22} /></span>sound<span>play</span></div>
        <div className="auth-visual-copy"><span className="eyebrow"><Sparkles size={14} /> SUA MÚSICA, SEM PAUSA</span><h1>Tem som que<br />fala por <em>você.</em></h1><p>Descubra, organize e ouça a trilha sonora dos seus momentos.</p></div>
        <div className="auth-decor-disc"><div /></div>
        <span className="auth-footer-note">SOUNDPLAY · DESCUBRA SEU PRÓXIMO SOM</span>
      </div>
      <div className="auth-form-side">
        <div className="mobile-auth-brand"><span className="brand-mark"><AudioLines size={21} /></span>sound<span>play</span></div>
        <div className="auth-card">
          <span className="eyebrow muted-eyebrow">BEM-VINDO À SUA MÚSICA</span>
          <h2>{mode === 'login' ? 'Entre no seu ritmo' : 'Crie sua conta'}</h2>
          <p>{mode === 'login' ? 'Acesse sua biblioteca e continue de onde parou.' : 'Sua próxima playlist começa com um cadastro.'}</p>
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'auth-tab selected' : 'auth-tab'} onClick={() => { setMode('login'); setError(''); }}>Entrar</button>
            <button className={mode === 'register' ? 'auth-tab selected' : 'auth-tab'} onClick={() => { setMode('register'); setError(''); }}>Criar conta</button>
          </div>
          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && <label>Seu nome<input autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Como podemos te chamar?" /></label>}
            <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" /></label>
            <label>Senha<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" /></label>
            {(error || notice) && <div className="auth-error" role="alert">{error || notice}</div>}
            <button className="primary-button auth-submit" disabled={busy}>{busy ? <span className="spinner dark-spinner" /> : mode === 'login' ? 'Entrar na minha conta' : 'Criar conta e entrar'}<span>→</span></button>
          </form>
          <div className="auth-secure"><ArrowDownToLine size={14} /> Seu acesso é protegido pela API Soundplay</div>
        </div>
        <span className="auth-legal">Ao continuar, você acessa sua conta pessoal Soundplay.</span>
      </div>
    </main>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

export default App;
