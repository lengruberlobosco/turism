Nota: o Web Share Target com arquivos (POST multipart) exige um handler no Service Worker que capture o POST em `/share-target`,
guarde o FormData em `caches.open("share-target")` e redirecione para `/share-target` (GET). O `generateSW` do Workbox não permite
código customizado; a Fase 2 de infraestrutura migra para `injectManifest` (src/sw.ts). Enquanto isso, links e texto compartilhados
já chegam via query string e arquivos podem ser anexados pela página Documentos.
