/**
 * CarePath Logo Component
 * Uses the actual brand logo from assets/logo.png
 */
import logoImg from '../assets/logo.png';

interface LogoProps {
  size?: number;
  textSize?: string;
}

export default function Logo({ size = 56 }: LogoProps) {
  const height = size;

  return (
    <img
      src={logoImg}
      alt="CarePath"
      className="cp-logo-img"
      style={{ height, width: 'auto', objectFit: 'contain' }}
    />
  );
}
