// Discover all Express registered routes
const path = require('path');
process.env.NODE_ENV = 'development';
const app = require('../src/server');

function extractRoutes(stack, prefix = '') {
  const routes = [];
  for (const layer of stack) {
    if (layer.route) {
      const route = layer.route;
      const methods = Object.keys(route.methods).map(m => m.toUpperCase());
      for (const method of methods) {
        routes.push({
          method,
          path: (prefix + (route.path === '/' && prefix ? '' : route.path)).replace(/\/+/g, '/'),
          stack: route.stack
        });
      }
    } else if (layer.name === 'router' && layer.handle.stack) {
      let routerPath = '';
      if (layer.regexp) {
        let str = layer.regexp.source;
        str = str.replace('\\/?(?=\\/|$)', '');
        str = str.replace('^\\', '');
        str = str.replace('\\/?$', '');
        str = str.replace(/\\\//g, '/');
        str = str.replace(/\\\?/g, '');
        str = str.replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':param');
        str = str.replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':param');
        routerPath = str;
      }
      routes.push(...extractRoutes(layer.handle.stack, prefix + routerPath));
    }
  }
  return routes;
}

const allRoutes = extractRoutes(app._router.stack);
console.log(`Discovered ${allRoutes.length} route handlers across application.`);

// Save to JSON for analysis
const fs = require('fs');
fs.writeFileSync(
  path.resolve(__dirname, 'endpoints_dump.json'),
  JSON.stringify(allRoutes.map(r => ({ method: r.method, path: r.path })), null, 2)
);

allRoutes.forEach((r, idx) => {
  console.log(`${idx + 1}. [${r.method}] ${r.path}`);
});

process.exit(0);
