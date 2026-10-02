import logoUrl from '../../../the-hive-logo.png';

export function MainBrandMark({ heading = false, className = '' }: { heading?: boolean; className?: string }) {
  const brandClassName = `hero-title brand-mark brand-mark-main${className ? ` ${className}` : ''}`;
  const image = <img className="brand-logo-img" src={logoUrl} alt={heading ? 'The Hive' : ''} />;
  return heading ? <h1 className={brandClassName}>{image}</h1> : <div className={brandClassName} aria-hidden>{image}</div>;
}
