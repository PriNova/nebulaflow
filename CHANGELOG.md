# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Sticky toolbar in WorkflowSidebar with toolbar buttons (Open, Save, Start/Stop, Clear, Help) anchored to the top of the sidebar during scrolling
  - Uses `tw-sticky tw-top-0` for positioning within the `tw-overflow-y-auto` scroll container
  - `tw-z-10` layering ensures toolbar sits above accordion content but below modals
  - Solid sidebar background color with border separator for visual clarity
  - All existing button actions and handlers remain unchanged
