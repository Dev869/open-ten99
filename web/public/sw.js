self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/dashboard/finance/receipts/share' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const files = formData.getAll('receipt');

        const cache = await caches.open('share-target');
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file instanceof File) {
            const response = new Response(file, {
              headers: { 'Content-Type': file.type, 'X-Filename': file.name },
            });
            await cache.put('/shared-receipt-' + i, response);
          }
        }

        return Response.redirect('/dashboard/finance/receipts?shared=true', 303);
      })()
    );
  }
});
