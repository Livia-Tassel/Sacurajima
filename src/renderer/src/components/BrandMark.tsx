import sakuraMark from '../assets/icons/sakura-mark.svg';

type BrandMarkProps = {
  alt: string;
  className?: string;
};

export function BrandMark({ alt, className }: BrandMarkProps) {
  return <img alt={alt} className={className} src={sakuraMark} />;
}

