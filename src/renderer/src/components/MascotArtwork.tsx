import happyArt from '../assets/illustrations/sakurajima-happy.svg';
import idleArt from '../assets/illustrations/sakurajima-idle.svg';
import thinkingArt from '../assets/illustrations/sakurajima-thinking.svg';
import sleepyArt from '../assets/illustrations/sakurajima-sleepy.svg';
import errorArt from '../assets/illustrations/sakurajima-error.svg';

const artworkMap = {
  error: errorArt,
  happy: happyArt,
  idle: idleArt,
  sleepy: sleepyArt,
  thinking: thinkingArt
} as const;

type MascotArtworkProps = {
  alt: string;
  className?: string;
  variant: keyof typeof artworkMap;
};

export function MascotArtwork({ alt, className, variant }: MascotArtworkProps) {
  return <img alt={alt} className={className} src={artworkMap[variant]} />;
}

