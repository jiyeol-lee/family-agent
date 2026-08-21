# Frontend structure

- Put route pages under `src/app/pages` in folders that mirror their pathname.
- Name page files `xxx.page.ts/html/css`, components `xxx.component.ts/html/css`, services `xxx.service.ts`, types `xxx.types.ts`, and routes `xxx.routes.ts`.
- Keep components and services used by one page flat in that page folder.
- Put components and services used by multiple pages in `src/app/components` or `src/app/services`.
- Import those root folders through `@pages/*`, `@components/*`, and `@services/*`.
- Provide page-only services at the page or lazy-route scope, preferably the route.
- Prefix interfaces and type aliases with `T`. Do not prefix classes.
- Export a type only when another file imports it.
- Prefix private class members, methods, accessors, and private parameter properties with `_`.
- Write `public` or `private` on class members. Constructors may omit `public`.
- Use Tailwind utilities for page styling and keep conditional utility classes statically detectable.
