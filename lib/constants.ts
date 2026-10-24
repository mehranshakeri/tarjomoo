// Multiplies a normalized block height (fraction of page height) back to CSS pixels.
// Derived from the 0.72pt→px base ratio at standard screen DPI, doubled for legibility.
export const TEXT_SCALE = 1.44

// Converts imageYLines (UI slider, in lines of 12pt text on an A4 page) to a
// normalized Y offset (fraction of page height).
export const IMAGE_Y_LINES_TO_OFFSET = 12 / 842
