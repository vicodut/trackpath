import { useState, useRef, useCallback, useEffect } from 'react';
import { TrackingPoint } from '../types';
import { AddPointForm } from './AddPointForm';
import { PointCard } from './PointCard';

interface SidebarProps {
  points: TrackingPoint[];
  totalDistanceKm: number;
  onSelectPoint: (point: TrackingPoint) => void;
  onDeletePoint: (id: number) => void;
  onAddPoint: (data: { latitude: number; longitude: number; altitude?: number | null; message?: string | null; tag?: string | null }) => Promise<boolean>;
  onFormToggle: (open: boolean) => void;
  pickedCoords: { lat: number; lng: number } | null;
  isAdmin: boolean;
}

export function Sidebar({
  points,
  totalDistanceKm,
  onSelectPoint,
  onDeletePoint,
  onAddPoint,
  onFormToggle,
  pickedCoords,
  isAdmin,
}: SidebarProps) {
  const [sheetHeight, setSheetHeight] = useState(25); // percentage of viewport
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const onDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    dragging.current = true;
    startY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startHeight.current = sheetHeight;
    document.body.style.userSelect = 'none';
  }, [sheetHeight]);

  const onDragMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!dragging.current) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = startY.current - clientY;
    const deltaPercent = (deltaY / window.innerHeight) * 100;
    const newHeight = Math.min(85, Math.max(10, startHeight.current + deltaPercent));
    setSheetHeight(newHeight);
  }, []);

  const onDragEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.userSelect = '';
    // Snap to positions
    setSheetHeight((h) => {
      if (h < 20) return 10;
      if (h < 50) return 40;
      return 85;
    });
  }, []);

  useEffect(() => {
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('touchend', onDragEnd);
    window.addEventListener('mouseup', onDragEnd);
    return () => {
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('touchend', onDragEnd);
      window.removeEventListener('mouseup', onDragEnd);
    };
  }, [onDragMove, onDragEnd]);

  return (
    <div
      className={`sidebar ${isMobile ? 'bottom-sheet' : ''}`}
      style={isMobile ? { height: `${sheetHeight}vh` } : undefined}
    >
      {isMobile && (
        <div className="sheet-handle" onTouchStart={onDragStart} onMouseDown={onDragStart}>
          <div className="sheet-handle-bar" />
        </div>
      )}
      <div className="sidebar-header">
        <h2>Tracking Points</h2>
        <div className="stats">
          <span>Points: <strong>{points.length}</strong></span>
          <span>Distance: <strong>{totalDistanceKm.toFixed(1)}</strong> km</span>
        </div>
      </div>
      {isAdmin && (
        <AddPointForm
          onSubmit={onAddPoint}
          onFormToggle={onFormToggle}
          pickedCoords={pickedCoords}
        />
      )}
      <div className="points-list">
        {[...points].reverse().map((pt) => (
          <PointCard
            key={pt.id}
            point={pt}
            onSelect={onSelectPoint}
            onDelete={isAdmin ? onDeletePoint : undefined}
          />
        ))}
      </div>
    </div>
  );
}
