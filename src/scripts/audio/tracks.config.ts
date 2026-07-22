/**
 * Orchestra-pit track registry. The pit UI renders this list verbatim; add
 * entries here and they appear in the drawer with zero UI changes.
 *
 * TODO(owner): add your own recordings — kind: 'owner-recording', src
 *   pointing at a file under /public/audio/ (e.g. '/audio/septuple-demo.mp3').
 * TODO(owner): add licensed embeds — kind: 'licensed-embed', embedUrl set to
 *   the provider's iframe URL (Bandcamp/SoundCloud/etc.), license noted.
 */

export interface PitTrack {
  /** Stable id, kebab-case. */
  id: string;
  /** Display title in the pit drawer. */
  title: string;
  /** Attribution line shown under the title. */
  artist: string;
  kind: 'owner-recording' | 'licensed-embed';
  /** For owner recordings: URL of an audio file served from /public. */
  src?: string;
  /** For licensed embeds: the provider iframe URL. */
  embedUrl?: string;
  /** License / rights note, shown small. Required for licensed embeds. */
  license?: string;
}

export const tracks: PitTrack[] = [
  // TODO(owner): first owner recording goes here, e.g.
  // {
  //   id: 'knock-study-i',
  //   title: 'Knock Study I (2+2+3)',
  //   artist: 'Wilhelm',
  //   kind: 'owner-recording',
  //   src: '/audio/knock-study-i.mp3',
  // },
  // TODO(owner): licensed embeds go here, e.g.
  // {
  //   id: 'some-licensed-piece',
  //   title: 'Some Licensed Piece',
  //   artist: 'Composer Name',
  //   kind: 'licensed-embed',
  //   embedUrl: 'https://bandcamp.com/EmbeddedPlayer/...',
  //   license: 'Embedded with permission / provider terms',
  // },
];
