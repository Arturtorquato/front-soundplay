# Soundplay — Front-end

Interface React + TypeScript conectada à API Spring Boot da pasta `soundplay`.

## Executar localmente

1. Inicie a API Spring Boot em `http://localhost:8080` e garanta que o PostgreSQL esteja ativo.
2. Nesta pasta, execute `npm install` e depois `npm run dev`.
3. Abra o endereço mostrado pelo Vite e entre com uma conta criada pela API.

Durante o desenvolvimento, as chamadas para `/api` são encaminhadas pelo proxy do Vite para `http://localhost:8080`, que remove o prefixo `/api` antes de enviar a requisição. Para outro endereço, defina `VITE_API_PROXY_TARGET` em um arquivo `.env`.

Para um deploy sem proxy, configure `VITE_API_URL` com a URL pública da API antes de executar `npm run build`. Nesse cenário, se o front e a API estiverem em origens diferentes, o backend também precisa permitir a origem do front via CORS. O token JWT é enviado no cabeçalho `Authorization: Bearer` para as rotas protegidas.

## Rotas utilizadas

- `POST /auth/login` e `POST /auth/register`
- `GET /musicas`, `POST /musicas`
- `GET /albuns`, `POST /albuns`
- `GET /artistas`, `POST /artistas`
- `GET /playlists/minhas`, `POST /playlists`
- `POST /playlists/{id}/musicas/{musicaId}`
- `DELETE /playlists/{id}` e `DELETE /playlists/{id}/musicas/{musicaId}`

## Área do artista

Depois de entrar, abra **Área do artista** no menu para criar um perfil de artista, cadastrar álbuns e cadastrar músicas. As faixas e os álbuns ficam associados ao perfil selecionado; a duração da música é informada em segundos e a URL de áudio/capa é opcional.

A API atual exige autenticação para essas rotas, mas não associa artista, álbum ou música ao usuário que fez o cadastro. Por isso, os registros pertencem ao catálogo compartilhado e esta interface não consegue garantir exclusividade ou propriedade por conta.
