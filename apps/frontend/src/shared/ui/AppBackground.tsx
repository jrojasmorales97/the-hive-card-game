function HexGrid() {
  const radius = 100;
  const columnStep = radius * 1.5;
  const rowStep = radius * Math.sqrt(3);
  const columns = 9;
  const rows = 4;
  const hexPoints = (cx: number, cy: number) => Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index;
    return `${+(cx + radius * Math.cos(angle)).toFixed(1)},${+(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
  const viewBoxWidth = (columns - 1) * columnStep + 2 * radius;
  const viewBoxHeight = (rows - 1) * rowStep + rowStep / 2 + radius;
  const hexes = Array.from({ length: columns }, (_, column) => {
    const centerX = column * columnStep + radius;
    const offset = column % 2 === 1 ? rowStep / 2 : 0;
    return Array.from({ length: rows }, (_, row) => ({
      points: hexPoints(centerX, row * rowStep + offset + radius * 0.4),
      key: `${column}-${row}`,
    }));
  }).flat();

  return <svg className="hero-hex-bg" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${viewBoxWidth.toFixed(0)} ${viewBoxHeight.toFixed(0)}`} preserveAspectRatio="xMidYMid slice" aria-hidden>{hexes.map(({ points, key }) => <polygon key={key} points={points} fill="none" stroke="#b889ff" strokeWidth="1" strokeOpacity="0.22" />)}</svg>;
}

export function AppBackground() {
  return <div className="app-bg" aria-hidden><HexGrid /><div className="hero-orb hero-orb-a" /><div className="hero-orb hero-orb-b" /></div>;
}
