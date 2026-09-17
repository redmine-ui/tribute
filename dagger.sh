image=mcr.microsoft.com/playwright:v1.60.0-noble

container |
  from $image |
  with-directory /src .|
  with-workdir /src |
  with-exec npm install |
  with-exec npm run lint |
  with-exec npm run typecheck:test |
  with-exec npm run test | stdout
