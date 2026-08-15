import { defineConfig } from 'allure';

export default defineConfig({
  name: 'Bunkai Test Report',
  output: './allure-report',
  plugins: {
    awesome: {
      options: {
        reportLanguage: 'en',
      },
    },
  },
});
