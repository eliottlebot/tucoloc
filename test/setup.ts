import '@testing-library/jest-dom/vitest'

// jsdom can't make local addresses for picked files (the Recipe form previews a photo before uploading it).
URL.createObjectURL = (file: Blob) => `blob:${file instanceof File ? file.name : 'file'}`
URL.revokeObjectURL = () => {}
