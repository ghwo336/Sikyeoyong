import type { Decorator, Preview } from '@storybook/react-vite';
import '../src/tokens/index.css';

// D-32: the app theme follows the dragon species through <html data-species>. The toolbar
// switches it, so every story can be seen in each theme (fixed parts must not change).
const withSpecies: Decorator = (Story, context) => {
  const species = typeof context.globals.species === 'string' ? context.globals.species : 'forest';
  document.documentElement.dataset.species = species;
  return Story();
};

// Design screens are 390px wide (design/tokens.json size.screenWidth).
const preview: Preview = {
  decorators: [withSpecies],
  globalTypes: {
    species: {
      description: '용 종류 테마 (D-32)',
      toolbar: {
        title: '테마',
        items: [
          { value: 'forest', title: '숲용' },
          { value: 'water', title: '물용' },
          { value: 'flower', title: '꽃용' },
          { value: 'star', title: '별용' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: 'centered',
    viewport: {
      options: {
        design390: {
          name: '시안 390',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
      },
    },
  },
  initialGlobals: {
    viewport: { value: 'design390', isRotated: false },
    species: 'forest',
  },
};

export default preview;
