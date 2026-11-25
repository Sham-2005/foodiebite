console.log('Environment variable keys:');
Object.keys(process.env).sort().forEach(k => {
  if (k.includes('SUPABASE') || k.includes('KEY') || k.includes('SECRET') || k.includes('ADMIN') || k.includes('API') || k.includes('TOKEN')) {
    console.log(k, '=', String(process.env[k]).substring(0, 15) + '...');
  }
});
