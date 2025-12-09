import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableFieldItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button {...attributes} {...listeners} style={{
          cursor: 'grab',
          touchAction: 'none',
          border: 'none',
          background: 'transparent',
          fontSize: '1.2rem',
          color: '#9ca3af'
        }}>
          ⠿
        </button>
        <div style={{ flexGrow: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
