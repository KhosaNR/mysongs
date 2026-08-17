import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Dynamic catalog pages render on-demand (SSR) — their IDs are not known
  // at build time, so they cannot be prerendered.
  {
    path: 'artist/:artistId',
    renderMode: RenderMode.Server,
  },
  {
    path: 'album/:albumId',
    renderMode: RenderMode.Server,
  },
  {
    path: 'song/:songId',
    renderMode: RenderMode.Server,
  },
  {
    path: 'playlist/:playlistId',
    renderMode: RenderMode.Server,
  },
  {
    path: 'collection/:collectionId',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
