# 🗺️ Structure Map UI Enhancement Plan

**Task**: Display detailed titles in Structure Map nodes.
**Date**: 2026-01-09

## 1. Requirement Analysis

- **Current**: Map nodes only show distinct structure types (e.g., "Introduction", "Body").
- **Requested**: Show the specific section title (e.g., "Early 30s Segment") below the type.
- **Goal**: Improve information density and context in the Map view.

## 2. Implementation Details

### 2.1 Component: `StructureTab.tsx`

- Locate the Map View rendering logic (likely `ReactFlow` or a custom SVG/Div implementation).
- Check the data source for nodes. It should contain `title` or `content` in addition to `type`.
- Update the Node component to render:
  ```tsx
  <div className="node-container ...">
    <div className="node-type">{type}</div>
    <div className="node-title text-xs opacity-80">{title}</div> {/* New Layer */}
  </div>
  ```

### 2.2 Styling

- Ensure the node size adjusts or clamps the text to avoid breaking layout.
- Use `line-clamp` for very long titles if necessary.

## 3. Verification

- Verify that map nodes display both the type (large/bold) and the title (small/secondary).
- Check responsiveness and overflow behavior.
