import path from 'path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react-swc';


export default defineConfig({
  plugins: [
    react({}),
  ].filter(Boolean),
  resolve: {
    alias: [
      {find: '@common', replacement: path.resolve(__dirname, '..', 'common', 'src')},
      {find: '@', replacement: path.resolve(__dirname, '..', 'client', 'src')},
      {find: '@client', replacement: path.resolve(__dirname, '..', 'client', 'src')},
      // {find: '@site', replacement: path.resolve(__dirname, '..', 'site', 'src')},
    ],
    dedupe: ['@babylonjs/core'],
  },
});
