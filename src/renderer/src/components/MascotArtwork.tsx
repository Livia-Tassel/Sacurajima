import happyArt from '../../../../assets/sakurajima-happy.png';
import idleArt from '../../../../assets/sakurajima-idle.png';
import thinkingArt from '../../../../assets/sakurajima-thinking.png';
import sleepyArt from '../../../../assets/sakurajima-sleepy.png';
import errorArt from '../../../../assets/sakurajima-error.png';
import type { CompanionMood } from '../../../shared/companion';

const artworkMap = {
  checkin: happyArt,
  error: errorArt,
  happy: happyArt,
  idle: idleArt,
  listening: idleArt,
  sleepy: sleepyArt,
  thinking: thinkingArt
} as const;

type MascotArtworkProps = {
  alt: string;
  className?: string;
  variant: CompanionMood | keyof typeof artworkMap;
};

export function MascotArtwork({ alt, className, variant }: MascotArtworkProps) {
  const resolvedVariant = variant in artworkMap ? variant : 'idle';
  return <img alt={alt} className={className} src={artworkMap[resolvedVariant as keyof typeof artworkMap]} />;
}
