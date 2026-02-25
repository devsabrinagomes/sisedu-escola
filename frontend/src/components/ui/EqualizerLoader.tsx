type EqualizerLoaderProps = {
  size?: number;
  className?: string;
};

export default function EqualizerLoader({
  size = 24,
  className = "",
}: EqualizerLoaderProps) {
  const barWidth = Math.max(3, Math.round(size * 0.16));
  const gap = Math.max(2, Math.round(size * 0.1));

  return (
    <div
      role="status"
      aria-label="Carregando"
      className={`inline-flex items-end justify-center ${className}`}
      style={{ height: size, gap }}
    >
      <span className="eq-bar" style={{ width: barWidth, height: Math.round(size * 0.45) }} />
      <span className="eq-bar" style={{ width: barWidth, height: Math.round(size * 0.65) }} />
      <span className="eq-bar" style={{ width: barWidth, height: Math.round(size * 0.55) }} />
      <span className="eq-bar" style={{ width: barWidth, height: Math.round(size * 0.7) }} />
    </div>
  );
}
