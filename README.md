# IB Studio · CRM

CRM privado de prospección de negocios locales. Cada cuenta tiene su propio
pipeline, aislado en PostgreSQL mediante Supabase Auth y Row-Level Security.

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **Supabase**: PostgreSQL, autenticación y Row-Level Security
- **Leaflet** para el mapa · **Recharts** para las gráficas
- Geocodificación con **Nominatim** (OpenStreetMap)

## Configurar Supabase

1. Crea un proyecto en Supabase o instala Supabase desde Vercel Marketplace.
2. Abre el SQL Editor de Supabase y ejecuta
   `supabase/migrations/20260718000000_initial_schema.sql`.
3. Copia `.env.example` a `.env.local` y completa la URL y la publishable key
   desde el panel **Connect** del proyecto.
4. En **Authentication → URL Configuration**, configura:
   - Site URL local: `http://localhost:3000`
   - Redirect URL local: `http://localhost:3000/auth/callback`
   - Añade también `https://tu-dominio.vercel.app/auth/callback` al desplegar.

Para producción, configura un proveedor SMTP propio en Supabase para los emails
de confirmación y recuperación de contraseña.

## Arrancar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000), crea una cuenta y confirma
el email. No se importa ni se crea ningún dato inicial.

## Funcionalidades

- Registro, login, recuperación de contraseña y gestión de cuenta.
- Datos aislados por usuario con políticas RLS en todas las tablas.
- Resumen con KPIs, pipeline, actividad semanal y próximos follow-ups.
- Tabla de leads con búsqueda, filtros y edición rápida.
- Mapa de negocios coloreado por estado.
- Etiquetas por cuenta y entrada rápida con `N` o `⌘K`.
