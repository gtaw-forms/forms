# Map Feature Implementation Notes

## Planned Feature: Screenshot on Marker Placement

**Goal:** Automatically capture a screenshot of the map location when a user places a marker, upload it to ImgBB, and include the image URL in the selected location data.

**Data Format:** `[url=IMAGE_URL]Street_Name(or nearest Street_Name)[/url]`

**Technical Approach:**

1.  **Screenshot Capture:**
    *   Use `dom-to-image` (already in `package.json`) to capture the map container.
    *   Trigger this process in `handleReportLocation` or `handleSelectLocation`.

2.  **Image Upload:**
    *   Utilize `@src/hooks/useImageUpload.js`.
    *   Adapt the hook or extract the upload logic to work within `MapModal.jsx`, as `MapModal` might not have the full form context `setFormData`.
    *   Alternatively, import the logic from `useImageUpload.js` if it's exportable, or duplicate the core fetch logic if the hook is too tightly coupled to the form state.

3.  **Data Flow:**
    *   User clicks map -> Marker placed.
    *   User clicks "Confirm Selection" / "Report Location".
    *   System captures screenshot of the map view (centered on marker).
    *   System uploads image.
    *   System formats string: `[url=${imageUrl}]${locationName}[/url]`.
    *   System passes this string to `onSelect` or saves it to Firebase.

**Dependencies:**
*   `dom-to-image`
*   `useImageUpload.js` (logic)
*   `VITE_IMGBB_API_KEY` (env var)

**Status:** Planned. To be implemented in a future update.