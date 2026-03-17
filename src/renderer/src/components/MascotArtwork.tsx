import happyArt from '../../../../assets/sakurajima-happy.png';
import idleArt from '../../../../assets/sakurajima-idle.png';
import thinkingArt from '../../../../assets/sakurajima-thinking.png';
import sleepyArt from '../../../../assets/sakurajima-sleepy.png';
import errorArt from '../../../../assets/sakurajima-error.png';

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
