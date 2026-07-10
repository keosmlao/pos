import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    // The existing application predates React Compiler lint rules. Keep the
    // release gate useful now; these rules can be adopted screen-by-screen.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react/no-unescaped-entities': 'off',
      // Data-loading effects intentionally call stable page-local loaders.
      // Converting every screen to useCallback is tracked separately and is
      // not a useful release blocker.
      'react-hooks/exhaustive-deps': 'off',
      // Uploaded logos/product photos and receipt canvas capture require raw
      // img elements; Next Image would change URLs and canvas behavior.
      '@next/next/no-img-element': 'off',
      '@next/next/no-page-custom-font': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'dist/**', 'backups/**', 'public/uploads/**']),
]);
