export function ThemeScript() {
  const themeScript = `
    (function() {
      // Check system preferences
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = prefersDark ? 'dark' : 'light';
      
      // Apply theme
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      }
      
      // Listen for changes in system preference
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const newTheme = e.matches ? 'dark' : 'light';
        
        // Use View Transitions API if available
        if (document.startViewTransition) {
          document.startViewTransition(() => {
            document.documentElement.setAttribute('data-theme', newTheme);
            if (newTheme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          });
        } else {
          // Fallback without transitions
          document.documentElement.setAttribute('data-theme', newTheme);
          if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      });
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}