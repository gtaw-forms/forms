// Migration UI — small field helpers used by the create pages:
//   - NowButton: stamps the current local time into a date/time field
//   - MapButton + useMapPicker: opens the shared GTA V map modal and returns
//     the picked location name for the field.
import React, { useState } from 'react';
import MapModal from '../Modals/MapModal';

export function NowButton({ onClick, title = 'Use the current local time' }) {
  return (
    <button type="button" className="btn ghost mini" title={title} onClick={onClick}>
      <i className="far fa-clock" aria-hidden="true" /> Now
    </button>
  );
}

export function MapButton({ onClick }) {
  return (
    <button type="button" className="btn ghost mini" title="Select a location from the map" onClick={onClick}>
      <i className="fas fa-map-marker-alt" aria-hidden="true" /> Map
    </button>
  );
}

/**
 * Map picker state + modal node. `onPick(name)` receives the map location name.
 * Render the returned `modal` once inside the form component.
 */
export function useMapPicker(onPick) {
  const [open, setOpen] = useState(false);
  return {
    open: () => setOpen(true),
    modal: (
      <MapModal
        show={open}
        onHide={() => setOpen(false)}
        onSelect={(location) => {
          if (location) onPick(location.rawName || location.name || '');
          setOpen(false);
        }}
        mapTargetField="placeOfDeath"
      />
    ),
  };
}
