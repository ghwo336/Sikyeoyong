import type { StorybookConfig } from '@storybook/react-vite';

// Component harness (D-18): every component state from its wiki doc is a story.
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
};

export default config;
