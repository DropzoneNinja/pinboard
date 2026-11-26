interface LightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function Lightbox({ src, alt, onClose }: LightboxProps) {
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <img src={src} alt={alt} className="lightbox-image" />
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}
